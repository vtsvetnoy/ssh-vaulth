use personal_ssh_crypto::{decrypt_vault, encrypt_vault, HostAuth, HostRecord, Vault};

fn sample_vault() -> Vault {
    Vault {
        schema_version: 1,
        hosts: vec![HostRecord {
            id: "host-1".to_string(),
            label: "Oracle Test".to_string(),
            hostname: "203.0.113.10".to_string(),
            port: 22,
            username: "ubuntu".to_string(),
            auth: HostAuth::Password {
                password: "secret-password".to_string(),
            },
            notes: "test host".to_string(),
            created_at: "2026-06-29T20:00:00Z".to_string(),
            updated_at: "2026-06-29T20:00:00Z".to_string(),
        }],
        updated_at: "2026-06-29T20:00:00Z".to_string(),
    }
}

#[test]
fn decrypts_with_correct_master_password() {
    let encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    let decrypted = decrypt_vault(&encrypted, "master-pass").unwrap();
    assert_eq!(decrypted.hosts[0].hostname, "203.0.113.10");
    assert_eq!(decrypted.hosts[0].username, "ubuntu");
}

#[test]
fn rejects_wrong_master_password() {
    let encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    let err = decrypt_vault(&encrypted, "wrong-pass")
        .unwrap_err()
        .to_string();
    assert!(err.contains("vault decrypt failed"));
}

#[test]
fn rejects_tampered_ciphertext() {
    let mut encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    encrypted.ciphertext.push('A');
    let err = decrypt_vault(&encrypted, "master-pass")
        .unwrap_err()
        .to_string();
    assert!(err.contains("vault decrypt failed"));
}
