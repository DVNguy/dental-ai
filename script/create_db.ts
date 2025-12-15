import pg from 'pg';
const { Client } = pg;

async function createDb() {
    const client = new Client({
        connectionString: 'postgresql://vannguy@localhost:5432/postgres'
    });

    try {
        await client.connect();
        // Check if db exists
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'praxisflow'");
        if (res.rowCount === 0) {
            console.log("Creating database praxisflow...");
            await client.query('CREATE DATABASE praxisflow');
            console.log("Database created!");
        } else {
            console.log("Database already exists.");
        }

        // Connect to praxisflow and enable vector extension
        await client.end();
        const praxisflowClient = new Client({
            connectionString: 'postgresql://vannguy@localhost:5432/praxisflow'
        });
        await praxisflowClient.connect();
        await praxisflowClient.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log("Vector extension enabled.");
        await praxisflowClient.end();

    } catch (err) {
        console.error("Error creating database:", err);
    } finally {
        await client.end();
    }
}

createDb();
