use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chacha20poly1305::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

const KDF_MEMORY_KIB: u32 = 64 * 1024;
const KDF_ITERATIONS: u32 = 3;
const KDF_PARALLELISM: u32 = 1;
const KEY_LENGTH: usize = 32;
const SALT_LENGTH: usize = 16;
const NONCE_LENGTH: usize = 24;
const SCHEMA_VERSION: u32 = 1;
const CIPHER: &str = "xchacha20poly1305";
const KDF_ALGORITHM: &str = "argon2id";

#[derive(Debug, Error)]
pub enum VaultCryptoError {
    #[error("vault encrypt failed")]
    EncryptFailed,
    #[error("vault decrypt failed")]
    DecryptFailed,
    #[error("vault serialization failed")]
    SerializationFailed(#[from] serde_json::Error),
    #[error("vault key derivation failed")]
    KeyDerivationFailed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub schema_version: u32,
    pub hosts: Vec<HostRecord>,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRecord {
    pub id: String,
    pub label: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth: HostAuth,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "type"
)]
pub enum HostAuth {
    Password {
        password: String,
    },
    PrivateKey {
        private_key: String,
        passphrase: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedVault {
    pub schema_version: u32,
    pub cipher: String,
    pub kdf: KdfParams,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KdfParams {
    pub algorithm: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub key_length: u32,
}

pub fn encrypt_vault(
    vault: &Vault,
    master_password: &str,
) -> Result<EncryptedVault, VaultCryptoError> {
    let mut salt = [0u8; SALT_LENGTH];
    let mut nonce = [0u8; NONCE_LENGTH];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);

    let kdf = KdfParams {
        algorithm: KDF_ALGORITHM.to_string(),
        memory_kib: KDF_MEMORY_KIB,
        iterations: KDF_ITERATIONS,
        parallelism: KDF_PARALLELISM,
        key_length: KEY_LENGTH as u32,
    };
    let key = derive_key(master_password, &salt, &kdf)?;
    let plaintext = serde_json::to_vec(vault)?;
    let cipher = XChaCha20Poly1305::new((&key).into());
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|_| VaultCryptoError::EncryptFailed)?;

    Ok(EncryptedVault {
        schema_version: SCHEMA_VERSION,
        cipher: CIPHER.to_string(),
        kdf,
        salt: STANDARD.encode(salt),
        nonce: STANDARD.encode(nonce),
        ciphertext: STANDARD.encode(ciphertext),
    })
}

pub fn decrypt_vault(
    encrypted: &EncryptedVault,
    master_password: &str,
) -> Result<Vault, VaultCryptoError> {
    validate_encrypted_metadata(encrypted)?;

    let salt = STANDARD
        .decode(&encrypted.salt)
        .map_err(|_| VaultCryptoError::DecryptFailed)?;
    let nonce = STANDARD
        .decode(&encrypted.nonce)
        .map_err(|_| VaultCryptoError::DecryptFailed)?;

    if salt.len() != SALT_LENGTH || nonce.len() != NONCE_LENGTH {
        return Err(VaultCryptoError::DecryptFailed);
    }

    let ciphertext = STANDARD
        .decode(&encrypted.ciphertext)
        .map_err(|_| VaultCryptoError::DecryptFailed)?;

    let key = derive_key(master_password, &salt, &encrypted.kdf)
        .map_err(|_| VaultCryptoError::DecryptFailed)?;
    let cipher = XChaCha20Poly1305::new((&key).into());
    let plaintext = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| VaultCryptoError::DecryptFailed)?;

    serde_json::from_slice(&plaintext).map_err(|_| VaultCryptoError::DecryptFailed)
}

fn validate_encrypted_metadata(encrypted: &EncryptedVault) -> Result<(), VaultCryptoError> {
    if encrypted.schema_version != SCHEMA_VERSION
        || encrypted.cipher != CIPHER
        || encrypted.kdf.algorithm != KDF_ALGORITHM
        || encrypted.kdf.memory_kib != KDF_MEMORY_KIB
        || encrypted.kdf.iterations != KDF_ITERATIONS
        || encrypted.kdf.parallelism != KDF_PARALLELISM
        || encrypted.kdf.key_length as usize != KEY_LENGTH
    {
        return Err(VaultCryptoError::DecryptFailed);
    }

    Ok(())
}

fn derive_key(
    master_password: &str,
    salt: &[u8],
    kdf: &KdfParams,
) -> Result<[u8; KEY_LENGTH], VaultCryptoError> {
    if kdf.algorithm != KDF_ALGORITHM || kdf.key_length as usize != KEY_LENGTH {
        return Err(VaultCryptoError::KeyDerivationFailed);
    }

    let params = Params::new(
        kdf.memory_kib,
        kdf.iterations,
        kdf.parallelism,
        Some(KEY_LENGTH),
    )
    .map_err(|_| VaultCryptoError::KeyDerivationFailed)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LENGTH];
    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut key)
        .map_err(|_| VaultCryptoError::KeyDerivationFailed)?;

    Ok(key)
}
