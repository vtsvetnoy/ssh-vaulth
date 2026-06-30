mod auth;
mod config;
mod db;
mod models;
mod routes;

use config::Config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env();
    let pool = db::connect(&config.database_url).await?;
    let app = routes::router(pool);
    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
