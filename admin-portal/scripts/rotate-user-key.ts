
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
    createCipheriv,
    createDecipheriv,
    hkdfSync,
    randomBytes
} from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER_KEY_ENV = process.env.STORAGE_MASTER_KEY;

const USER_ID = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !MASTER_KEY_ENV || !USER_ID) {
    console.error('Missing args.');
    console.error('Usage: npm run script:rotate-user-key <USER_ID>');
    process.exit(1);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = 1;
const MASTER_KEY_SALT = 'cadenza-master-key-v1'; // do not change

function deriveMasterKey(): Buffer {
    return Buffer.from(hkdfSync('sha256', Buffer.from(MASTER_KEY_ENV!), Buffer.alloc(0), MASTER_KEY_SALT, 32));
}

function encryptUserKey(userKey: Buffer): string {
    const masterKey = deriveMasterKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(userKey), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from([VERSION]), iv, authTag, encrypted]).toString('base64');
}

function generateUserKey(): Buffer {
    return randomBytes(32);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

async function rotateUserKey() {
    console.log(`Rotating User Key for: ${USER_ID}`);

    const { data: user, error } = await supabaseAdmin
        .from('cadenza_profiles')
        .select('encrypted_storage_key')
        .eq('id', USER_ID)
        .single();

    if (error || !user?.encrypted_storage_key) {
        throw new Error('User not found or has no key');
    }

    const newKey = generateUserKey();
    const encrypted = encryptUserKey(newKey);

    const { error: updateError } = await supabaseAdmin
        .from('cadenza_profiles')
        .update({ encrypted_storage_key: encrypted })
        .eq('id', USER_ID);

    if (updateError) {
        throw updateError;
    }

    console.log('User key updated in DB.');
    console.warn(
        'Note: existing encrypted files were not re-encrypted. Run a dedicated migration if stored files must be rotated.'
    );
}

rotateUserKey().catch(console.error);
