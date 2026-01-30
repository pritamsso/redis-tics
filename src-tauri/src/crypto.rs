use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

const NONCE_SIZE: usize = 12;

fn get_key_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("redis-tics");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join(".key")
}

fn get_or_create_key() -> [u8; 32] {
    let key_path = get_key_path();
    
    if key_path.exists() {
        if let Ok(key_data) = fs::read(&key_path) {
            if key_data.len() == 32 {
                let mut key = [0u8; 32];
                key.copy_from_slice(&key_data);
                return key;
            }
        }
    }
    
    let mut key = [0u8; 32];
    rand::thread_rng().fill(&mut key);
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&key_path)
        {
            use std::io::Write;
            let _ = file.write_all(&key);
        }
    }
    
    #[cfg(not(unix))]
    {
        let _ = fs::write(&key_path, &key);
    }
    
    key
}

fn derive_key(master_key: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(master_key);
    hasher.update(b"redis-tics-encryption-v1");
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

pub fn encrypt_password(password: &str) -> Result<String, String> {
    if password.is_empty() {
        return Ok(String::new());
    }

    let master_key = get_or_create_key();
    let key = derive_key(&master_key);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut combined = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

pub fn decrypt_password(encrypted: &str) -> Result<String, String> {
    if encrypted.is_empty() {
        return Ok(String::new());
    }

    let combined = BASE64.decode(encrypted).map_err(|e| e.to_string())?;
    
    if combined.len() < NONCE_SIZE {
        return Err("Invalid encrypted data".to_string());
    }

    let master_key = get_or_create_key();
    let key = derive_key(&master_key);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    let nonce = Nonce::from_slice(&combined[..NONCE_SIZE]);
    let ciphertext = &combined[NONCE_SIZE..];

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed - invalid key or corrupted data")?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "my_secret_password";
        let encrypted = encrypt_password(password).unwrap();
        let decrypted = decrypt_password(&encrypted).unwrap();
        assert_eq!(password, decrypted);
    }

    #[test]
    fn test_empty_password() {
        let encrypted = encrypt_password("").unwrap();
        assert_eq!(encrypted, "");
        let decrypted = decrypt_password("").unwrap();
        assert_eq!(decrypted, "");
    }
}
