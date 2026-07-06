use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
};

use portable_pty::{native_pty_system, Child, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Window};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHost {
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "type"
)]
pub enum SshAuth {
    Password {
        password: String,
    },
    PrivateKey {
        private_key: String,
        private_key_passphrase: Option<String>,
    },
    PasswordAndPrivateKey {
        password: String,
        private_key: String,
        private_key_passphrase: Option<String>,
    },
}

#[derive(Default)]
pub struct SshSessions {
    sessions: Mutex<HashMap<String, SshSession>>,
}

struct SshSession {
    child: Box<dyn Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
    key_file_path: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshOutputEvent {
    session_id: String,
    data: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshExitEvent {
    session_id: String,
}

pub fn build_ssh_args(host: &SshHost, key_file_path: Option<&str>) -> Vec<String> {
    let mut args = vec![
        "-tt".to_string(),
        "-p".to_string(),
        host.port.to_string(),
        "-o".to_string(),
        "ServerAliveInterval=30".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=3".to_string(),
        "-o".to_string(),
        "ConnectTimeout=10".to_string(),
        "-o".to_string(),
        "ConnectionAttempts=1".to_string(),
    ];

    if let Some(path) = key_file_path {
        args.extend([
            "-i".to_string(),
            path.to_string(),
            "-o".to_string(),
            "IdentitiesOnly=yes".to_string(),
        ]);
    }

    args.extend([
        "-l".to_string(),
        host.username.clone(),
        host.hostname.clone(),
    ]);
    args
}

pub fn start_session(
    window: Window,
    sessions: &SshSessions,
    host: SshHost,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;

    let key_file_path = write_key_file(&host)?;
    let key_arg = key_file_path
        .as_ref()
        .and_then(|path| path.to_str())
        .map(str::to_string);

    let mut command = CommandBuilder::new("ssh");
    for arg in build_ssh_args(&host, key_arg.as_deref()) {
        command.arg(arg);
    }

    let child = match pair.slave.spawn_command(command) {
        Ok(child) => child,
        Err(err) => {
            remove_key_file(key_file_path.as_ref());
            return Err(err.to_string());
        }
    };
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| err.to_string())?;
    let writer = pair.master.take_writer().map_err(|err| err.to_string())?;
    let session_id = Uuid::new_v4().to_string();
    let output_session_id = session_id.clone();
    let output_window = window.clone();

    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = output_window.emit(
                        "ssh-output",
                        SshOutputEvent {
                            session_id: output_session_id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }

        let _ = output_window.emit(
            "ssh-exit",
            SshExitEvent {
                session_id: output_session_id,
            },
        );
    });

    sessions
        .sessions
        .lock()
        .map_err(|_| "SSH session lock poisoned".to_string())?
        .insert(
            session_id.clone(),
            SshSession {
                child,
                writer,
                key_file_path,
            },
        );

    Ok(session_id)
}

pub fn write_session(sessions: &SshSessions, session_id: &str, data: &str) -> Result<(), String> {
    let mut guard = sessions
        .sessions
        .lock()
        .map_err(|_| "SSH session lock poisoned".to_string())?;
    let session = guard
        .get_mut(session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|err| err.to_string())?;
    session.writer.flush().map_err(|err| err.to_string())
}

pub fn stop_session(sessions: &SshSessions, session_id: &str) -> Result<(), String> {
    let mut guard = sessions
        .sessions
        .lock()
        .map_err(|_| "SSH session lock poisoned".to_string())?;
    if let Some(mut session) = guard.remove(session_id) {
        let _ = session.child.kill();
        remove_key_file(session.key_file_path.as_ref());
    }
    Ok(())
}

fn write_key_file(host: &SshHost) -> Result<Option<PathBuf>, String> {
    let private_key = match &host.auth {
        SshAuth::Password { .. } => return Ok(None),
        SshAuth::PrivateKey { private_key, .. }
        | SshAuth::PasswordAndPrivateKey { private_key, .. } => private_key,
    };

    if private_key.trim().is_empty() {
        return Ok(None);
    }

    let path = std::env::temp_dir().join(format!("ssh-vault-{}.key", Uuid::new_v4()));
    fs::write(&path, private_key).map_err(|err| err.to_string())?;
    secure_key_permissions(&path)?;
    Ok(Some(path))
}

#[cfg(unix)]
fn secure_key_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)
        .map_err(|err| err.to_string())?
        .permissions();
    permissions.set_mode(0o600);
    fs::set_permissions(path, permissions).map_err(|err| err.to_string())
}

#[cfg(not(unix))]
fn secure_key_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn remove_key_file(path: Option<&PathBuf>) {
    if let Some(path) = path {
        let _ = fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_system_ssh_args_for_host() {
        let host = SshHost {
            hostname: "example.test".to_string(),
            port: 2222,
            username: "ubuntu".to_string(),
            auth: SshAuth::Password {
                password: "secret".to_string(),
            },
        };

        let args = build_ssh_args(&host, None);

        assert_eq!(args[0], "-tt");
        assert_eq!(args[1], "-p");
        assert_eq!(args[2], "2222");
        assert_eq!(args[3], "-o");
        assert_eq!(args[4], "ServerAliveInterval=30");
        assert_eq!(args[5], "-o");
        assert_eq!(args[6], "ServerAliveCountMax=3");
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-o", "ConnectTimeout=10"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-o", "ConnectionAttempts=1"]));
        assert!(args.windows(2).any(|pair| pair == ["-l", "ubuntu"]));
        assert_eq!(args.last(), Some(&"example.test".to_string()));
    }

    #[test]
    fn builds_system_ssh_args_for_domain_style_username() {
        let host = SshHost {
            hostname: "example.test".to_string(),
            port: 22,
            username: "user@example-directory.test".to_string(),
            auth: SshAuth::Password {
                password: "secret".to_string(),
            },
        };

        let args = build_ssh_args(&host, None);

        assert!(args
            .windows(2)
            .any(|pair| pair == ["-l", "user@example-directory.test"]));
        assert_eq!(args.last(), Some(&"example.test".to_string()));
    }

    #[test]
    fn builds_system_ssh_args_with_private_key_path() {
        let host = SshHost {
            hostname: "example.test".to_string(),
            port: 2222,
            username: "ubuntu".to_string(),
            auth: SshAuth::PrivateKey {
                private_key: "key".to_string(),
                private_key_passphrase: None,
            },
        };

        let args = build_ssh_args(&host, Some("/tmp/ssh-key"));

        assert!(args.iter().any(|arg| arg == "-i"));
        assert!(args.iter().any(|arg| arg == "/tmp/ssh-key"));
        assert!(args.iter().any(|arg| arg == "IdentitiesOnly=yes"));
    }
}
