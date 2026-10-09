# Hosting OpenReply 100% Free on Oracle Cloud Infrastructure (OCI)

This guide documents the complete step-by-step process for deploying **OpenReply** on **Oracle Cloud's Always Free Tier** at **$0.00 / month forever**.

---

## Architecture & Free Tier Resource Specs

| Component | Option 1 (ARM - Preferred) | Option 2 (AMD - Active Deployment) | Cost |
| :--- | :--- | :--- | :--- |
| **Shape** | `VM.Standard.A1.Flex` (Ampere ARM) | `VM.Standard.E2.1.Micro` (AMD) | **$0.00** |
| **Specs** | Up to 4 OCPUs, 24 GB RAM | 1 OCPU, 1 GB RAM (+ 4GB Swap file) | **$0.00** |
| **Location in Console** | *Shape Series > Ampere* | *Shape Series > Specialty and previous generation* | **$0.00** |
| **Operating System** | Canonical Ubuntu 24.04 LTS | Canonical Ubuntu 24.04 LTS | **$0.00** |
| **Server Public IP** | Assigned Ephemeral IPv4 | `80.225.220.80` | **$0.00** |
| **Public HTTPS URL** | Vercel proxy project (permanent) | `https://openreply-murex.vercel.app` | **$0.00** |
| **SSH Key Path** | Custom Private Key | `/Users/apple/My Projects/openreply/ssh-key-2026-08-03.key` | **$0.00** |
| **Web App & API** | Next.js 16 (App Router) via `pm2` | Next.js 16 (App Router) via `pm2` | **$0.00** |
| **Background Worker** | BullMQ queue worker (`npm run worker`) via `pm2` | BullMQ queue worker (`npm run worker`) via `pm2` | **$0.00** |
| **Database** | PostgreSQL 16 (Local) | PostgreSQL 16 (Local) | **$0.00** |
| **Cache & Queue** | Redis 7 (Local) | Redis 7 (Local) | **$0.00** |
| **SSL / HTTPS** | Vercel-managed TLS at the edge | Vercel-managed TLS at the edge | **$0.00** |

---

## Step 1: Provision Oracle Cloud Compute Instance

1. Log into [Oracle Cloud Console](https://cloud.oracle.com).
2. Navigate to **Compute > Instances > Create Instance**.
3. **Basic Information**:
   - **Name**: `openreplay`
   - **Compartment**: Root compartment (`rahulmirji (root)`).
4. **Placement**: Availability Domain `AD-1`.
5. **Image and Shape**:
   - Click **Change Image** -> Select **Canonical Ubuntu 24.04** (`Price: Free`).
   - Click **Change Shape** -> Select **Specialty and previous generation** -> Choose **`VM.Standard.E2.1.Micro`** (**Always Free-eligible**).
6. **Add SSH Keys**:
   - Select **Generate a key pair for me**.
   - Click **Save private key** -> saved to `/Users/apple/My Projects/openreply/ssh-key-2026-08-03.key`.
7. **Boot Volume**: Keep default size (46.6 GB – well under the 200 GB free limit).
8. Click **Create** and wait for the instance state to turn `RUNNING` (green).

---

## Step 2: Assign Public IPv4 Address & Oracle Ingress Rules

1. On the Instance page, click the **Networking** tab.
2. Under **Primary VNIC**, click your VNIC link (`openreply`).
3. Click the **IP administration** tab at the top.
4. Click the **Three Dots (`...`)** on the right side of the IP row -> Click **Edit**.
5. Select **Ephemeral Public IP** -> Click **Update** (assigned `80.225.220.80`).
6. Under **Networking > VCN (`vcn-20260803-1247`) > Security Lists > Default Security List**, click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`, **IP Protocol**: `TCP`, **Destination Port Range**: `80, 443`.

---

## Step 3: Connect via SSH & Setup Server Environment

### A. SSH Access
```bash
chmod 400 "/Users/apple/My Projects/openreply/ssh-key-2026-08-03.key"
ssh -i "/Users/apple/My Projects/openreply/ssh-key-2026-08-03.key" ubuntu@80.225.220.80
```

### B. Firewall & 4GB Swap Memory
```bash
sudo iptables -F
sudo netfilter-persistent save

sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### C. Install Software Stack
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx certbot python3-certbot-nginx postgresql postgresql-contrib redis-server cloudflared
sudo npm install -g pm2
```

---

## Step 4: Configure PostgreSQL, Redis & Free Cloudflare HTTPS Tunnel

### A. PostgreSQL Setup
```bash
sudo -u postgres psql -c "CREATE DATABASE openreply;"
sudo -u postgres psql -c "CREATE USER openreply WITH PASSWORD 'openreply_secure_pass_2026';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE openreply TO openreply;"
```

### B. Permanent HTTPS Entrypoint (Vercel proxy)

Meta requires an **`https://`** URL for webhooks and OAuth logins.

> [!WARNING]
> Do **not** use a Cloudflare quick tunnel (`cloudflared tunnel --url ...`) for
> this. Quick tunnels have no persistent identity, so Cloudflare issues a new
> random `*.trycloudflare.com` hostname every time the process starts, and the
> Meta callback and webhook URLs have to be re-entered by hand each time. This
> setup previously used one and churned through at least three hostnames.

A Cloudflare *named* tunnel is the proper fix but needs a domain. Serving TLS
straight from the VPS needs inbound port 443, which is closed in the Oracle
security list. Instead, a tiny Vercel project owns the permanent hostname and
forwards to port 80 on the VPS, which the security list already allows:

```
https://openreply-murex.vercel.app   (fixed, Vercel-managed TLS)
        |
        v  HTTP :80
80.225.220.80 -> nginx -> Next.js :3000
```

The proxy is just a rewrite rule; see `vercel-proxy/` in the repo. Deploy it as
a Vercel project with **Root Directory** `vercel-proxy` and no build command.
If the VPS public IP ever changes, edit `destination` in
`vercel-proxy/vercel.json` and redeploy — the public hostname stays the same, so
the Meta console never needs touching again.

Because the hostname no longer depends on any VPS process, PM2 services can be
restarted and redeployed freely.

---

## Step 5: Deploy OpenReply & PM2 Process Setup

### A. Environment Configuration (`.env`)
Update `~/openreply/.env`:
```env
NEXTAUTH_URL="https://your-domain.com"
AUTH_TRUST_HOST=true
NEXTAUTH_SECRET="your-generated-nextauth-secret"
CRON_SECRET="your-generated-cron-secret"
ENCRYPTION_KEY="your-generated-32-byte-hex-encryption-key"

DATABASE_URL="postgresql://openreply:your_db_password@localhost:5432/openreply"
REDIS_URL="redis://localhost:6379"

RESEND_API_KEY="re_sample_api_key"
EMAIL_FROM="onboarding@resend.dev"

META_GRAPH_API_VERSION="v25.0"
INSTAGRAM_APP_ID="your_instagram_app_id"
INSTAGRAM_APP_SECRET="your_instagram_app_secret"
FACEBOOK_APP_SECRET="your_facebook_app_secret"
WEBHOOK_VERIFY_TOKEN="your_webhook_verify_token"
```

### B. Build App & Run Database Migrations
```bash
npm run db:generate
npm run db:migrate
npm run build
```

### C. Start PM2 Processes
```bash
pm2 start "npm start" --name openreply-web
pm2 start "npm run worker" --name openreply-worker
pm2 save
```

---

## Step 6: Meta Developer Console & Instagram Connection

### A. Webhook & OAuth Setup
1. **OAuth Redirect URI** (Meta Console > Instagram API > **4. Set up Instagram business login** > Click **Set up**):
   - **Valid OAuth Redirect URIs**: `https://openreply-murex.vercel.app/api/instagram/callback`
2. **Webhooks Setup** (Meta Console > Instagram API > **3. Configure webhooks**):
   - **Callback URL**: `https://openreply-murex.vercel.app/api/webhook`
   - **Verify Token**: `openreply_verify_token_2026`
   - **Subscription**: Subscribe to `comments`.
3. **Account Webhook Subscription** (Meta Console > Instagram API > **2. Generate access tokens**):
   - Find account `rahul_mirji.ai` -> Turn `Webhook Subscription` toggle to **On**.

---

## What to do with Access Tokens? (Automated OAuth Handling)

> 💡 **You do NOT need to manually copy or paste the Access Token into `.env` or code.**

* **Manual Access Token in Meta Console**: The token shown under "Generate access tokens" in Meta's UI is only for manual API testing.
* **Automatic Token Management in OpenReply**: When you click the **`Connect Instagram`** button in the OpenReply dashboard, OpenReply securely performs the OAuth authorization flow:
  1. Requests Instagram permissions (`instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`).
  2. Exchanges the authorization code for a long-lived access token.
  3. Encrypts the token using **AES-256-GCM** with your `ENCRYPTION_KEY`.
  4. Stores the encrypted token securely in PostgreSQL (`Account` table).
  5. The OpenReply background worker (`openreply-worker`) automatically decrypts the token when sending DMs and refreshes it daily.

---

## Troubleshooting & Gotchas

* **Email Magic Links in Spam**: Initial sign-in emails sent from `onboarding@resend.dev` will land in your Spam/Junk folder. Check Spam and click "Report Not Spam".
* **Vercel Analytics 404 Warning**: Self-hosted servers will show a harmless `/_vercel/insights/script.js 404` console warning because Vercel tracking scripts are not hosted locally.
* **OAuth Callback vs. Webhook URL**:
  - Webhooks use `/api/webhook`
  - Instagram Login OAuth uses `/api/instagram/callback`

---

## Golden Rules to Ensure $0.00 / Month Forever

- ✅ **Shape Selection**: Use shapes tagged **`Always Free-eligible`**.
- ✅ **RAM/Swap**: Use 4GB Swap file on AMD Micro instances to prevent memory bottlenecks.
- ✅ **HTTPS URL**: Use a Vercel proxy project for a permanent hostname. Avoid Cloudflare quick tunnels, whose hostname changes on every restart.
- ✅ **Storage**: Keep combined boot volume storage $\le 200\text{ GB}$.
