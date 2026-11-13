# KEN CoffeeInBed

## Requirements

- Node.js 20 or newer and npm.
- A local MongoDB instance or a MongoDB Atlas connection string.

## First-time setup

Clone the `pthao` branch:

```bash
git clone -b pthao https://github.com/httpsmanhuynh/KEN_CoffeeInBed.git
cd KEN_CoffeeInBed
```

Create the backend configuration from the template, then replace
`MONGODB_URI` and `SESSION_SECRET` with local values:

```bat
copy my-server-mongodb\.env.example my-server-mongodb\.env
```

Install dependencies:

```bash
cd my-server-mongodb
npm install
cd ..\my-app
npm install
```

## Run the project

Open two terminals at the repository root.

Terminal 1 (API):

```bash
cd my-server-mongodb
npm start
```

Terminal 2 (Angular):

```bash
cd my-app
npm start
```

Open `http://localhost:4200`. The Angular proxy forwards `/api` to the
backend at port `3002`.

## Validate

```bash
cd my-app
npm run build
```

Backend tests:

```bash
cd my-server-mongodb
npm test
```

Do not commit `node_modules`, Angular cache, real `.env` files, or `.zip`
archives. These paths are ignored by the repository `.gitignore`.
