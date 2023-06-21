// @ts-check

const path = require('node:path');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

const prompts = require('prompts');
const fs = require('fs-extra');
const { Listr } = require('listr2');
const Stripe = require('stripe');

let cancelled = false;

const prompt = (initialOptions) =>
  prompts(
    [
      {
        type: 'password',
        name: 'stripeSecretKey',
        message: 'What is your Stripe secret key?',
      },
      {
        type: 'password',
        name: 'stripePublishableKey',
        message: 'What is your Stripe publishable key?',
      },
      {
        type: 'password',
        name: 'stripeWebhookKey',
        message:
          "What is your Stripe Webhook Endpoint key (it's okay if you dont have one right now)?",
      },
      {
        type: () =>
          shouldSkip(initialOptions, 'addDummyProducts') ? null : 'confirm',
        name: 'addDummyProducts',
        message:
          'Would you like us to add dummy products to your Stripe account?',
        initial: false,
      },
    ],
    {
      onCancel: () => {
        cancelled = true;
      }
    }
  );

const updateDotEnv = async (options) => {
  const dotEnvPath = path.join(options.dir, '.env');

  fs.appendFileSync(dotEnvPath, [
    `STRIPE_SECRET_KEY='${options.stripeSecretKey}'`,
    `STRIPE_PUBLISHABLE_KEY='${options.stripePublishableKey}'`,
    `STRIPE_WEBHOOK_KEY='${options.stripeWebhookKey}'`,
  ].join('\n'))
};

const addDummyProducts = async (options) => {
  const stripe = new Stripe(options.stripeSecretKey);

  // esbuild parses JSON files into JS objects at build time.
  // See https://esbuild.github.io/content-types/#json.
  const superpowers = require('./superpowers');

  for (const superpower of superpowers) {
    const { prices, ...productData } = superpower;

    const product = await stripe.products.create(productData);

    for (const price of prices) {
      await stripe.prices.create({
        product: product.id,
        ...price,
      });
    }
  }
};

const copyTemplateFiles = async (options) => {
  const srcDir = path.join(__dirname, '..', 'templates');
  const destDir = options.dir;

  await fs.mkdirp(srcDir);

  await fs.copy(srcDir, destDir);
};

const shouldSkip = (options, step) => [...(options.skip || [])].includes(step);

const importSchemasAndServices = async () => {
  const graphQLFile = './api/src/functions/graphql.js'
  fs.readFile(graphQLFile, 'utf8', (err, data) => {
    
  if (err) {
    return console.log(err);
  }
    
    // Replace services and sdls
    const result = data.replace(/import sdls from/g, 'import * as rwSdls from');
    const result2 = result.replace(/import services from/g, 'import * as rwServices from');

    // import plugin services at top of file
    

    // create new sdls and schemas objects
    

  fs.writeFile(graphQLFile, result2, 'utf8', (err) => {
     if (err) return console.log(err);
  });
});
}

const scaffold = async (options) => {
  if (!shouldSkip(options, 'pluginDeps')) {
    await exec('yarn add @redwoodjs-stripe/web', { cwd: path.join(options.dir, 'web') });
    await exec('yarn add @redwoodjs-stripe/api', { cwd: path.join(options.dir, 'api') });
  }

  await updateDotEnv(options);

  if (!shouldSkip(options, 'rwGenerate')) {
    await exec('yarn rw g page stripe-demo', { cwd: options.dir });
  }

  await copyTemplateFiles(options);
};

const setup = async (initialOptions) => {
  const responses = await prompt(initialOptions)

  if (cancelled) {
    process.exitCode = 1
    return
  }

  const options = {
    dir: process.cwd(),
    ...initialOptions,
    ...responses
  };

  const tasks = [
    options.addDummyProducts && {
      title: 'Adding dummy products',
      task: () => addDummyProducts(options),
    },
    // {
    //   title: 'Scaffolding out project files',
    //   task: () => scaffold(options),
    // },
    {
      title: 'Importing Schemas and Services',
      task: () => importSchemasAndServices()
    }
  ].filter(Boolean);

  try {
    await new Listr(tasks).run();
  } catch (e) {
    console.error(e);
  }

  console.log('Your RedwoodJS-Stripe integration is ready! 🎉');
  console.log(
    'Run `yarn rw dev` and then navigate to http://localhost:8910/stripe-demo for a little demo.'
  );
};

module.exports = {
  setup,
};
