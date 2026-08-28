require('dotenv/config');

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const CA_PATH = process.env.DATABASE_CA_PATH ?? join(__dirname, '..', 'certs', 'supabase-ca.crt');

const PACKS = [
  {
    name: 'Starter Pack',
    description: '20 spins to get a feel for the reels.',
    priceCents: 2_000_000,
    spinsGranted: 20,
    imageUrl: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&q=70',
    available: 12,
  },
  {
    name: 'Player Pack',
    description: '60 spins, and enough runway to chase a diamond line.',
    priceCents: 5_000_000,
    spinsGranted: 60,
    imageUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=600&q=70',
    available: 7,
  },
  {
    name: 'High Roller',
    description: '200 spins for someone who intends to be here a while.',
    priceCents: 15_000_000,
    spinsGranted: 200,
    imageUrl: 'https://images.unsplash.com/photo-1541278107931-e006523892df?w=600&q=70',
    available: 3,
  },
];

const SCHEMA = `
  create extension if not exists "pgcrypto";

  create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text not null,
    price_cents bigint not null check (price_cents > 0),
    currency text not null default 'COP',
    image_url text not null,
    spins_granted int not null check (spins_granted > 0)
  );

  create table if not exists stock (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null unique references products(id) on delete cascade,
    available int not null default 0 check (available >= 0),
    reserved int not null default 0 check (reserved >= 0)
  );
`;

function ssl() {
  if (process.env.DATABASE_CA_CERT) {
    return { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true };
  }
  if (existsSync(CA_PATH)) {
    return { ca: readFileSync(CA_PATH, 'utf8'), rejectUnauthorized: true };
  }
  throw new Error(`No CA certificate at ${CA_PATH}. See README.`);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: ssl() });
  await client.connect();

  try {
    await client.query(SCHEMA);

    for (const pack of PACKS) {
      const { rows } = await client.query(
        `insert into products (name, description, price_cents, currency, image_url, spins_granted)
         values ($1, $2, $3, 'COP', $4, $5)
         on conflict (name) do update set
           description = excluded.description,
           price_cents = excluded.price_cents,
           image_url = excluded.image_url,
           spins_granted = excluded.spins_granted
         returning id`,
        [pack.name, pack.description, pack.priceCents, pack.imageUrl, pack.spinsGranted],
      );

      await client.query(
        `insert into stock (product_id, available, reserved)
         values ($1, $2, 0)
         on conflict (product_id) do update set available = excluded.available`,
        [rows[0].id, pack.available],
      );

      console.log(`seeded ${pack.name} (${pack.available} available)`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
