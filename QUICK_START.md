# Quick Start: Deploy to DigitalOcean in 15 Minutes

## Prerequisites Checklist
- [ ] DigitalOcean account created
- [ ] Credit card added (or $200 free credit from referral)
- [ ] Domain name ready (optional)

---

## Step-by-Step Commands

### 1. Create Droplet (5 min)
1. Go to DigitalOcean → Create → Droplets
2. Choose: **Ubuntu 22.04**, **Regular 2GB RAM** ($12/month)
3. Add SSH key or password
4. Click "Create Droplet"
5. **Copy the IP address** (e.g., `123.456.789.012`)

### 2. Connect to Server (1 min)
```bash
ssh root@YOUR_DROPLET_IP
# Enter password if prompted
```

### 3. One-Command Setup (5 min)
Copy and paste this entire block:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 and Nginx
npm install -g pm2
apt install -y nginx git build-essential

# Create deploy user (optional but recommended)
adduser deploy
usermod -aG sudo deploy
su - deploy

# Clone your repo (replace with your repo URL)
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ensured-advisor
cd ensured-advisor

# Install dependencies
npm install
cd client && npm install && cd ..

# Build frontend
cd client && npm run build && cd ..

# Create environment file
cd server
nano .env.local
# Paste your GEMINI_API_KEY and save (Ctrl+X, Y, Enter)
cd ..

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions

# Setup Nginx
sudo nano /etc/nginx/sites-available/ensured-advisor
# Copy Nginx config from DEPLOYMENT_GUIDE.md

sudo ln -s /etc/nginx/sites-available/ensured-advisor /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 4. Configure Nginx (2 min)
```bash
sudo nano /etc/nginx/sites-available/ensured-advisor
```

Paste this (replace paths if different):
```nginx
upstream api_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    root /home/deploy/ensured-advisor/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }

    client_max_body_size 50M;
}
```

Save and restart:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Test (2 min)
1. Open browser: `http://YOUR_DROPLET_IP`
2. Upload a test policy PDF
3. Check if analysis works

---

## Common Issues & Quick Fixes

**502 Bad Gateway?**
```bash
pm2 logs ensured-advisor-api
pm2 restart ensured-advisor-api
```

**Can't access site?**
```bash
sudo ufw status
sudo ufw allow 'Nginx Full'
```

**Build fails?**
```bash
cd client
rm -rf node_modules dist
npm install
npm run build
```

---

## Next Steps After Basic Setup

1. **Add Domain:** Update DNS → Point to droplet IP
2. **Add SSL:** `sudo certbot --nginx -d yourdomain.com`
3. **Update CORS:** Edit `server/index.ts` CORS origin
4. **Monitor:** `pm2 monit` to watch resources

---

## Estimated Costs

- **Droplet:** $12/month (2GB RAM)
- **Domain:** $10-15/year
- **SSL:** Free (Let's Encrypt)
- **Total:** ~$12-13/month

---

## Need Help?

- Check `DEPLOYMENT_GUIDE.md` for detailed steps
- DigitalOcean Community: https://www.digitalocean.com/community
- PM2 Docs: https://pm2.keymetrics.io/docs

