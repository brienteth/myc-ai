# 🌐 MYCA PRODUCTION VPS DEPLOYMENT PLAYBOOK (3-NODE CLUSTER)

> **Proving "Real Distributed Network" Status across Hetzner & DigitalOcean Data Centers**

This guide provides the exact production instructions to deploy the canonical 3-node cluster:
1. `bootstrap-01.mycai.pro` (Frankfurt, Germany — Hetzner CPX21)
2. `bootstrap-02.mycai.pro` (New York, USA — DigitalOcean s-2vcpu-4gb)
3. `validator-01.mycai.pro` (Helsinki, Finland — Hetzner CPX31)

---

## 1. Domain & DNS Architecture

Create the following **A Records** on your DNS provider (Cloudflare, Namecheap, etc.):

| Hostname | Target IP (Example) | Role | Region |
| :--- | :--- | :--- | :--- |
| `bootstrap-01.mycai.pro` | `159.69.x.x` | Seed Peer & Discovery | EU-Central (Frankfurt) |
| `bootstrap-02.mycai.pro` | `134.209.x.x` | Seed Peer & Discovery | US-East (New York) |
| `validator-01.mycai.pro` | `65.108.x.x` | BFT Block Proposer & Validator | EU-North (Helsinki) |

---

## 2. 1-Click Server Provisioning (Run on each VPS)

SSH into your freshly created Ubuntu 22.04 / 24.04 VPS:

```bash
ssh root@<YOUR_SERVER_IP>
```

Clone the repository and run the automated provisioning script:

```bash
git clone https://github.com/myc-network/myc-network.git /opt/myc-network
cd /opt/myc-network
chmod +x deploy/setup_vps.sh
./deploy/setup_vps.sh
```

The script automatically:
* Updates APT packages and installs fail2ban.
* Installs Node.js 20 LTS.
* Hardens the firewall (`UFW` allows ports `22`, `80`, `443`, `4040`, `50346-50360`).
* Registers and starts the `myc-node.service` under systemd.

---

## 3. Configuring Node Roles

### On `bootstrap-01.mycai.pro`:
Create `/opt/myc-network/.env`:
```env
NODE_ID=bootstrap-01
HOSTNAME=bootstrap-01.mycai.pro
ROLE=BOOTSTRAP_DISCOVERY
P2P_PORT=50346
PORT=4040
CHAIN_ID=108
```

### On `bootstrap-02.mycai.pro`:
Create `/opt/myc-network/.env`:
```env
NODE_ID=bootstrap-02
HOSTNAME=bootstrap-02.mycai.pro
ROLE=BOOTSTRAP_DISCOVERY
P2P_PORT=50346
PORT=4040
CHAIN_ID=108
BOOTSTRAP_PEERS=tcp://bootstrap-01.mycai.pro:50346
```

### On `validator-01.mycai.pro`:
Create `/opt/myc-network/.env`:
```env
NODE_ID=validator-01
HOSTNAME=validator-01.mycai.pro
ROLE=BFT_VALIDATOR
P2P_PORT=50347
PORT=4040
CHAIN_ID=108
BOOTSTRAP_PEERS=tcp://bootstrap-01.mycai.pro:50346,tcp://bootstrap-02.mycai.pro:50346
VALIDATOR_KEYPAIR=/etc/myc/validator_key.json
```

Restart service after updating configuration:
```bash
systemctl restart myc-node
```

---

## 4. HTTPS & SSL Reverse Proxy (Nginx + Certbot)

To access `https://bootstrap-01.mycai.pro/nexus` securely:

```bash
apt-get install -y nginx certbot python3-certbot-nginx

cat << 'EOF' > /etc/nginx/sites-available/myc
server {
    server_name bootstrap-01.mycai.pro;

    location / {
        proxy_pass http://127.0.0.1:4040;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/myc /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d bootstrap-01.mycai.pro --non-interactive --agree-tos -m admin@mycai.pro
```

---

## 5. Live Multi-Server Verification Commands

Verify that the 3 VPS nodes are discovering each other across the WAN:

```bash
# Check connected peers on validator-01:
curl -s http://validator-01.mycai.pro:4040/api/status | jq .p2pPeers

# Verify block synchronization across WAN:
curl -s http://bootstrap-01.mycai.pro:4040/api/explorer/overview | jq .blockHeight
curl -s http://bootstrap-02.mycai.pro:4040/api/explorer/overview | jq .blockHeight
curl -s http://validator-01.mycai.pro:4040/api/explorer/overview | jq .blockHeight

# Test Dynamic APY response:
curl -s http://bootstrap-01.mycai.pro:4040/api/staking/dynamic-apy | jq .
```
