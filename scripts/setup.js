import { BucketsClient, CreateBucketCommand, ReadBucketCommand } from "@stedi/sdk-client-buckets";
import { FunctionsClient, ReadFunctionCommand } from "@stedi/sdk-client-functions";
import { writeFile } from "fs/promises";

main();

async function main() {
  // Create the client that provides access to Stedi Buckets.
  const bucketsClient = new BucketsClient({
    // The region that hosts your bucket. At the moment, "us" is the only option.
    region: "us",

    // Read your API key from an environment variable.
    apiKey: process.env.STEDI_API_KEY
  });

  // Create the client that provides access to Stedi Functions.
  const functionsClient = new FunctionsClient({
    // The region that hosts your function. At the moment, "us" is the only option.
    region: "us",

    // Read your API key from an environment variable.
    apiKey: process.env.STEDI_API_KEY
  });


  // The names we want to use for the buckets. However, bucket names need to be globally unique, so
  // it’s unlikely these names are available. We’ll add a suffix to these names in a second.
  const inputBucketBaseName = "demo-notification-input";
  const outputBucketBaseName = "demo-notification-output";

  // The name of the function. This one only has to be unique in your account. However, if it
  // already exists, it will be overwritten when you run scripts/deploy.js, so we’ll test for that
  // and if the function already exists, we’ll use a different name.
  const functionBaseName = "demo-notification";

  // First try if we can use just the base names.
  let inputBucketName = inputBucketBaseName;
  let outputBucketName = outputBucketBaseName;
  let functionName = functionBaseName;

  // Try different names for the buckets until we find a pair that’s available. There’s a limit on
  // how often we’ll try, just in case there’s a bug in the code that would lead to an infinite
  // loop.
  for (let i = 0; i < 25; i++) {
    // Is either of the bucket names already in use?
    if (
      await bucketExists(bucketsClient, inputBucketName) ||
      await bucketExists(bucketsClient, outputBucketName)
    ) {
      // Yes, add a suffix to the base name to make it unique. The suffix is a random string, but
      // it’s not guaranteed to be unique. We could use a UUID instead and know for sure that the
      // name is available, but that’ll be a hassle if we ever have to type the name.
      var suffix = generateSuffix();
      inputBucketName = `${inputBucketBaseName}-${suffix}`;
      outputBucketName = `${outputBucketBaseName}-${suffix}`;
    }
  }

  // Can we use the base name for the function?
  if (await functionExists(functionsClient, functionName)) {
    // No, it’s already taken. If the buckets are using a suffix, use that one for the function as
    // well. Otherwise, generate a new suffix.
    suffix = suffix || generateSuffix();
    functionName = `${functionBaseName}-${suffix}`;
  }

  // Create the input bucket.
  await bucketsClient.send(new CreateBucketCommand({
    bucketName: inputBucketName,

    // You can add the notification during creation of the bucket, or you can do it later, after
    // you’ve deployed the function. If you want to do it here, uncomment the next few lines. If you
    // want to do it later, run scripts/notification.js.
    // notifications: {
    //   functions: [{
    //     functionName: functionName
    //   }]
    // }
  }));

  // Create the output bucket.
  await bucketsClient.send(new CreateBucketCommand({
    bucketName: outputBucketName
  }));

  // We’re not creating the function at this point. For that, we’ll use script/deploy.js. This makes
  // it possible to redeploy the code when we change it without recreating the buckets.

  // The function needs to know the name of the output bucket. It gets that from the environment
  // variables, which are stored in the .env file. Here, we create the .env file.
  // The function doesn’t need to know the name of the input bucket, because it will get that as
  // part of the notification it receives. It also doesn’t need to know the name of the function,
  // because it doesn’t need to call itself.
  await writeFile(".env", `
    # These are settings that the function needs to run. They’re deployed together with the function.

    # The name of the bucket where the function will store its output.
    OUTPUT_BUCKET=${outputBucketName}
  `);
  
  // There are a couple of helper scripts we’ll run later on that need to know the bucket names and
  // the function name. We create scripts/settings.js and the helper scripts can import that script
  // to get the names.
  await writeFile("scripts/settings.js", `
    import dotenv from "dotenv";

    // These are settings that the support scripts in the scripts directory need. These settings
    // aren’t deployed with the function. Settings for the function are in the .env file.

    export default {
      // The name of the function.
      functionName: "${functionName}",

      // The name of the bucket that will trigger the function when it receives a new file.
      inputBucketName: "${inputBucketName}",

      // The name of the bucket where the function will store its output. The function needs this
      // setting, so it’s stored in the .env file. We load the .env file and get the setting from
      // there so that we don’t have to update it in two separate places.
      outputBucketName: dotenv.config().parsed.OUTPUT_BUCKET
    }
  `);
}

async function bucketExists(bucketsClient, bucketName) {
  try {
    // Try to retrieve the bucket.
    await bucketsClient.send(new ReadBucketCommand({
      bucketName: bucketName
    }));

    // Retrieving the bucket didn’t lead to an error, so it must exist.
    return true;
  }
  catch (exception) {
    if (exception.name === "ResourceNotFoundException") {
      // The bucket doesn’t exist.
      return false;
    }
    else {
      // Something else went wrong. Nothing we can do but rethrow the exception.
      throw exception
    }
  }
}

async function functionExists(functionsClient, functionName) {
  try {
    // Try to retrieve the function.
    await functionsClient.send(new ReadFunctionCommand({
      functionName: functionName
    }));

    // Retrieving the function didn’t lead to an error, so it must exist.
    return true;
  }
  catch (exception) {
    if (exception.name === "ResourceNotFoundException") {
      // The function doesn’t exist.
      return false;
    }
    else {
      // Something else went wrong. Nothing we can do but rethrow the exception.
      throw exception
    }
  }
}

function generateSuffix() {
  // The suffix will be an alteration of consonants and vowels. That’ll make it easy to read and
  // type, should that be necessary.
  const consonants = [ "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "y", "z" ];
  const vowels = [ "a", "e", "i", "o", "u" ];

  let suffix = "";
  for (let i = 0; i < 4; i++) {
    const consonantIndex = Math.floor(Math.random() * consonants.length);
    suffix += consonants[consonantIndex];

    const vowelIndex = Math.floor(Math.random() * vowels.length);
    suffix += vowels[vowelIndex];
  }

  return suffix;
}