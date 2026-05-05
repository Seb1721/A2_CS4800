# EC2 Deployment

This guide runs CarKeeper on a single EC2 instance with a stable public IP. MongoDB Atlas should allowlist the EC2 Elastic IP instead of `0.0.0.0/0`.

## 1. Create the EC2 Instance

Use Ubuntu 22.04 or 24.04 LTS. In the EC2 security group, allow:

- SSH `22` from your IP only
- HTTP `80` from anywhere
- HTTPS `443` from anywhere

Do not expose port `3000` publicly. Nginx should be the public entrypoint.

Allocate and associate an Elastic IP with the instance. Add that Elastic IP to MongoDB Atlas under **Network Access**.

## 2. Install Server Dependencies

SSH into the instance, then install Node, Nginx, Git, and PM2:

```bash
sudo apt update
sudo apt install -y git nginx
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
npm install -g pm2
```

## 3. Clone the App

```bash
cd ~
git clone YOUR_REPO_SSH_URL A2_CS4800
cd A2_CS4800
git checkout carkeeper_webapp_next.js
```

Create `.env.production` on the EC2 instance:

```bash
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=carkeeper
AUTH_SECRET=replace_with_a_long_random_secret
CARKEEPER_ADMIN_USER=admin
CARKEEPER_ADMIN_EMAIL=admin@example.com
CARKEEPER_ADMIN_PASSWORD=replace_with_a_strong_password
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Never commit `.env.production`.

## 4. First Deployment

```bash
bash scripts/deploy-ec2.sh
pm2 startup
```

Run the command printed by `pm2 startup`, then save the process list:

```bash
pm2 save
```

## 5. Configure Nginx

Create `/etc/nginx/sites-available/carkeeper`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/carkeeper /etc/nginx/sites-enabled/carkeeper
sudo nginx -t
sudo systemctl reload nginx
```

For HTTPS, point your domain DNS to the Elastic IP, then use Certbot.

## 6. Automatic Deployment from GitHub

The workflow at `.github/workflows/deploy.yml` deploys on pushes to `carkeeper_webapp_next.js`.

Add these GitHub repository secrets:

- `EC2_HOST`: the Elastic IP or domain
- `EC2_USER`: usually `ubuntu`
- `EC2_SSH_KEY`: private SSH key that can log into the EC2 instance
- `EC2_APP_DIR`: optional; defaults to `~/A2_CS4800`

The EC2 instance also needs Git access to the repository. For a private repo, add a deploy key in GitHub and put the matching private key on the EC2 instance, or use an HTTPS token-backed remote.

After that, every push to `carkeeper_webapp_next.js` will SSH into EC2, pull the latest code, run tests, build, and reload PM2.
