use aes_gcm::{
    aead::{rand_core::RngCore, Aead, OsRng},
    AeadCore, Aes256Gcm, Key, KeyInit, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD, Engine};
use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct PasswordEntry {
    title: String,
    password: String,
    username: Option<String>,
    url: Option<String>,
    notes: Option<String>,
    tags: Vec<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Vault {
    entries: Vec<PasswordEntry>,
    created_at: u64, // seconds since 1970
}

#[derive(Debug, PartialEq)]
pub struct EncryptedVault {
    ciphertext: Vec<u8>,
    nonce: Vec<u8>,
    salt: Vec<u8>,
}

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
pub enum VaultError {
    InvalidPassword, // wrong password
    VaultNotFound,   // no file
    CorruptedVault,  // cannot parse / decode
    CryptoError,     // encryption/decryption failed
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredVault {
    ciphertext: String,
    nonce: String,
    salt: String,
}

impl Vault {
    pub fn new() -> Self {
        Self {
            entries: vec![],
            created_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    pub fn save(&self, password: &str) -> Result<(), VaultError> {
        let ev = encrypt_vault(self, password)?;

        save_vault(&ev)?;

        Ok(())
    }

    pub fn add_entry(&mut self, entry: PasswordEntry) {
        self.entries.push(entry);
    }

    pub fn delete_entry(&mut self, index: usize) -> Result<(), VaultError> {
        if index >= self.entries.len() {
            return Err(VaultError::CorruptedVault);
        };

        self.entries.remove(index);
        Ok(())
    }
}

impl EncryptedVault {
    pub fn decrypt(&self, password: &str) -> Result<Vault, VaultError> {
        decrypt_vault(self, password)
    }
}

fn encrypt_vault(vault: &Vault, password: &str) -> Result<EncryptedVault, VaultError> {
    let serialized = serde_json::to_string(vault).map_err(|_| VaultError::CorruptedVault)?;
    let bytes = serialized.into_bytes();

    let salt = generate_salt();

    let key_bytes = derive_key(password, &salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let cipher = Aes256Gcm::new(key);
    let ciphertext = cipher
        .encrypt(&nonce, bytes.as_slice())
        .map_err(|_| VaultError::CryptoError)?;

    Ok(EncryptedVault {
        ciphertext,
        nonce: nonce.to_vec(),
        salt,
    })
}

fn decrypt_vault(ev: &EncryptedVault, password: &str) -> Result<Vault, VaultError> {
    let key_bytes = derive_key(password, &ev.salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

    let cipher = Aes256Gcm::new(key);

    if ev.nonce.len() != 12 {
        return Err(VaultError::CorruptedVault);
    }

    let nonce = Nonce::from_slice(&ev.nonce);

    let deciphered = cipher
        .decrypt(nonce, ev.ciphertext.as_slice())
        .map_err(|_| VaultError::InvalidPassword)?;

    let json = String::from_utf8(deciphered).map_err(|_| VaultError::CorruptedVault)?;
    let vault: Vault = serde_json::from_str(&json).map_err(|_| VaultError::CorruptedVault)?;

    Ok(vault)
}

fn derive_key(password: &str, salt: &[u8]) -> Vec<u8> {
    let argon2 = Argon2::default();

    let mut key = vec![0u8; 32];

    argon2
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .unwrap();

    key
}

fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; 16];

    OsRng.fill_bytes(&mut salt);

    salt
}

fn save_vault(ev: &EncryptedVault) -> Result<(), VaultError> {
    let stored = StoredVault {
        ciphertext: STANDARD.encode(&ev.ciphertext),
        nonce: STANDARD.encode(&ev.nonce),
        salt: STANDARD.encode(&ev.salt),
    };

    let json = serde_json::to_string(&stored).unwrap();

    fs::write("vault.enc", json).map_err(|_| VaultError::VaultNotFound)?;

    Ok(())
}

pub fn load_vault() -> Result<EncryptedVault, VaultError> {
    let saved = fs::read_to_string("vault.enc").map_err(|_| VaultError::VaultNotFound)?;
    let sv: StoredVault = serde_json::from_str(&saved).map_err(|_| VaultError::CorruptedVault)?;
    let decode = |s: &str| STANDARD.decode(s).map_err(|_| VaultError::CorruptedVault);

    let ev = EncryptedVault {
        ciphertext: decode(&sv.ciphertext)?,
        nonce: decode(&sv.nonce)?,
        salt: decode(&sv.salt)?,
    };

    Ok(ev)
}
