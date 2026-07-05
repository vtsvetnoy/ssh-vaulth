use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use uuid::Uuid;

use crate::auth::hash_password;

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    seed_admin_user(&pool).await?;
    Ok(pool)
}

async fn seed_admin_user(pool: &PgPool) -> anyhow::Result<()> {
    if std::env::var("SSH_VAULT_SEED_ADMIN").as_deref() != Ok("1") {
        return Ok(());
    }

    let email = std::env::var("SSH_VAULT_ADMIN_EMAIL").unwrap_or_else(|_| "admin".to_string());
    let password =
        std::env::var("SSH_VAULT_ADMIN_PASSWORD").unwrap_or_else(|_| "admin".to_string());
    let password_hash = hash_password(&password)?;
    let user_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING",
    )
    .bind(user_id)
    .bind(&email)
    .bind(password_hash)
    .execute(pool)
    .await?;

    let row = sqlx::query("SELECT id FROM users WHERE email = $1")
        .bind(&email)
        .fetch_one(pool)
        .await?;
    let stored_user_id = row.try_get::<Uuid, _>("id")?;

    sqlx::query(
        "INSERT INTO vaults (user_id, version, encrypted_vault)
         VALUES ($1, 0, NULL)
         ON CONFLICT (user_id) DO NOTHING",
    )
    .bind(stored_user_id)
    .execute(pool)
    .await?;

    Ok(())
}
