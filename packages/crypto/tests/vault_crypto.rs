use base64::{engine::general_purpose::STANDARD, Engine as _};
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
fn round_trips_vault_equality() {
    let vault = sample_vault();
    let encrypted = encrypt_vault(&vault, "master-pass").unwrap();
    let decrypted = decrypt_vault(&encrypted, "master-pass").unwrap();
    assert_eq!(decrypted, vault);
}

#[test]
fn round_trips_password_and_private_key_auth() {
    let mut vault = sample_vault();
    vault.hosts[0].auth = HostAuth::PasswordAndPrivateKey {
        password: "server-password".to_string(),
        private_key: "-----BEGIN PRIVATE KEY-----".to_string(),
        private_key_passphrase: Some("key-passphrase".to_string()),
    };

    let encrypted = encrypt_vault(&vault, "master-pass").unwrap();
    let decrypted = decrypt_vault(&encrypted, "master-pass").unwrap();

    assert_eq!(decrypted, vault);
}

#[test]
fn encrypts_with_expected_salt_and_nonce_lengths() {
    let encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    let salt = STANDARD.decode(&encrypted.salt).unwrap();
    let nonce = STANDARD.decode(&encrypted.nonce).unwrap();

    assert_eq!(salt.len(), 16);
    assert_eq!(nonce.len(), 24);
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
    let mut ciphertext = STANDARD.decode(&encrypted.ciphertext).unwrap();
    ciphertext[0] ^= 0x01;
    encrypted.ciphertext = STANDARD.encode(ciphertext);

    let err = decrypt_vault(&encrypted, "master-pass")
        .unwrap_err()
        .to_string();
    assert!(err.contains("vault decrypt failed"));
}

#[test]
fn rejects_unsupported_kdf_params() {
    let cases = [
        |encrypted: &mut personal_ssh_crypto::EncryptedVault| {
            encrypted.kdf.algorithm = "argon2i".to_string();
        },
        |encrypted: &mut personal_ssh_crypto::EncryptedVault| {
            encrypted.kdf.memory_kib = 1024;
        },
        |encrypted: &mut personal_ssh_crypto::EncryptedVault| {
            encrypted.kdf.iterations = 1;
        },
        |encrypted: &mut personal_ssh_crypto::EncryptedVault| {
            encrypted.kdf.parallelism = 2;
        },
    ];

    for mutate in cases {
        let mut encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
        mutate(&mut encrypted);

        let err = decrypt_vault(&encrypted, "master-pass")
            .unwrap_err()
            .to_string();
        assert!(err.contains("vault decrypt failed"));
    }
}

#[test]
fn rejects_wrong_nonce_length() {
    let mut encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    encrypted.nonce = STANDARD.encode([0u8; 23]);

    let err = decrypt_vault(&encrypted, "master-pass")
        .unwrap_err()
        .to_string();
    assert!(err.contains("vault decrypt failed"));
}

#[test]
fn rejects_unsupported_cipher() {
    let mut encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    encrypted.cipher = "aes256gcm".to_string();

    let err = decrypt_vault(&encrypted, "master-pass")
        .unwrap_err()
        .to_string();
    assert!(err.contains("vault decrypt failed"));
}

#[test]
fn rejects_unsupported_schema_version() {
    let mut encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    encrypted.schema_version = 2;

    let err = decrypt_vault(&encrypted, "master-pass")
        .unwrap_err()
        .to_string();
    assert!(err.contains("vault decrypt failed"));
}
