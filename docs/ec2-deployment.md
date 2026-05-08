# EC2 Deployment

This guide runs CarKeeper on a single EC2 instance with a stable public IP. MongoDB Atlas should allowlist the EC2 Elastic IP instead of `0.0.0.0/0`.

## 1. Create the EC2 Instance

Use Ubuntu 22.04 or 24.04 LTS, or Amazon Linux 2023. In the EC2 security group, allow:

- SSH `22` from your IP only
- HTTP `80` from anywhere
- HTTPS `443` from anywhere

Do not expose port `3000` publicly. Nginx should be the public entrypoint.

Allocate and associate an Elastic IP with the instance. Add that Elastic IP to MongoDB Atlas under **Network Access**.

## 2. Install Server Dependencies

Use the package flow that matches your instance OS.

### Amazon Linux 2023

```bash
sudo dnf update -y
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

### Ubuntu 22.04 or 24.04

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
git clone YOUR_REPO_SSH_URL app
cd app
git checkout carkeeper_webapp_next.js
```

Create `.env.production` on the EC2 instance. `.env.local` also works if that is what you already use on the server:

```bash
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=carkeeper
AUTH_SECRET=replace_with_a_long_random_secret
CARKEEPER_ADMIN_USER=admin
CARKEEPER_ADMIN_EMAIL=admin@example.com
CARKEEPER_ADMIN_PASSWORD=replace_with_a_strong_password
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
COOKIE_SECURE=true
```

Never commit `.env.production` or `.env.local`.

If you are testing directly on `http://<elastic-ip>:3000` before Nginx/HTTPS is configured, temporarily set:

```bash
COOKIE_SECURE=false
```

Switch it back to `true` once the app is served over HTTPS.

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

On Amazon Linux, create `/etc/nginx/conf.d/carkeeper.conf`. On Ubuntu, you can use either the same `conf.d` path or the `sites-available`/`sites-enabled` pattern if you prefer.

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name your-domain.com www.your-domain.com;

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

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If Amazon Linux is still serving the default welcome page, remove the default `server {}` block from `/etc/nginx/nginx.conf` so your `conf.d/carkeeper.conf` server becomes the active default.

For HTTPS, point your domain DNS to the Elastic IP, then use Certbot:

```bash
sudo dnf install -y python3 augeas-libs
sudo python3 -m venv /opt/certbot
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
sudo ln -s /opt/certbot/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot renew --dry-run
```

After HTTPS is active, set `COOKIE_SECURE=true` in the server env file and restart the app.

## 6. Automatic Deployment From GitHub

The safer deployment path is to run GitHub Actions on a self-hosted runner installed on the EC2 instance instead of opening SSH to GitHub's hosted runners.

Important: GitHub recommends extra caution with self-hosted runners on public repositories because untrusted workflow code can run on the machine. This setup is best for private repositories, or for repositories where you tightly control which workflows can execute on the self-hosted runner.

The workflow at `.github/workflows/deploy.yml` deploys on pushes to `main` and `carkeeper_webapp_next.js`. It deploys the branch that triggered the workflow.

### Add the self-hosted runner on EC2

In GitHub, open:

- `Repository -> Settings -> Actions -> Runners -> New self-hosted runner`

Choose `Linux` and `x64`, then run the generated commands on the EC2 instance in a separate directory such as:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
```

After `config.sh` finishes, install the runner as a service:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

The deploy workflow targets the runner's default labels:

- `self-hosted`
- `Linux`
- `X64`

### Configure the deployment path

Add a GitHub repository variable:

- `EC2_APP_DIR`: `/home/ec2-user/app`

The EC2 instance still needs Git access to the repository. For a private repo, add a deploy key in GitHub and put the matching private key on the EC2 instance, or use an HTTPS token-backed remote.

After that, every push to either deployment branch will run the deployment job directly on the EC2 instance, pull the latest code, run tests, build, and reload PM2.
