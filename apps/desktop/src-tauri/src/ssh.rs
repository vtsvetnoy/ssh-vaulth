use std::{
    collections::HashMap,
    io::{Read, Write},
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
}

#[derive(Default)]
pub struct SshSessions {
    sessions: Mutex<HashMap<String, SshSession>>,
}

struct SshSession {
    child: Box<dyn Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
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

pub fn build_ssh_args(host: &SshHost) -> Vec<String> {
    vec![
        "-tt".to_string(),
        "-p".to_string(),
        host.port.to_string(),
        "-o".to_string(),
        "ServerAliveInterval=30".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=3".to_string(),
        format!("{}@{}", host.username, host.hostname),
    ]
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

    let mut command = CommandBuilder::new("ssh");
    for arg in build_ssh_args(&host) {
        command.arg(arg);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| err.to_string())?;
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
                        "ssh://output",
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
            "ssh://exit",
            SshExitEvent {
                session_id: output_session_id,
            },
        );
    });

    sessions
        .sessions
        .lock()
        .map_err(|_| "SSH session lock poisoned".to_string())?
        .insert(session_id.clone(), SshSession { child, writer });

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
    }
    Ok(())
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
        };

        let args = build_ssh_args(&host);

        assert_eq!(args[0], "-tt");
        assert_eq!(args[1], "-p");
        assert_eq!(args[2], "2222");
        assert_eq!(args[3], "-o");
        assert_eq!(args[4], "ServerAliveInterval=30");
        assert_eq!(args[5], "-o");
        assert_eq!(args[6], "ServerAliveCountMax=3");
        assert_eq!(args[7], "ubuntu@example.test");
    }
}
