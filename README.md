# Sending bucket notifications to a function

A bucket can send a notification to a function running on Stedi every time it receives a file. The function will get a message as its first arguments with information about the file. It’ll look something like this.

```javascript
{
  "Records": [{
    "eventName":"ObjectCreated:Put",
    "s3": {
      "bucket": {
        "name": "demo-notification-input"
      },
      "object": {
        "key": "test.txt"
        "size": 1493
      }
    }
  }]
}
```

With the information in the message, the function can get the contents of the file from Stedi Buckets. Actually, the code above only shows the part of the message that’s relevant to bucket notifications. The [full message](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html) contains more fields.

Of course, you need a bucket and a function to make this work. You also need to set up the notification. The notification settings are part of the bucket, not of the function.

## Prerequisites

You need to create:

- [A Stedi account](https://www.stedi.com/terminal/sign-up).
- [An API key](https://www.stedi.com/app/settings/api-keys).

You need to install:

- [Node.js](https://nodejs.org/) for running the function on your local machine.

You need to clone this repository and install its dependencies.

```console
git clone https://github.com/Stedi-Demos/bucket-notifications.git
cd bucket-notifications
npm ci
```

## Overview

File                                       | Description
-------------------------------------------|------------
[handler.js](src/handler.js)               | Contains the code for the function that receives the bucket notification.
[local.js](scripts/local.js)               | Allows you to test the function on your local machine before deploying it to Stedi.
[setup.js](scripts/setup.js)               | Creates the resources you need for this demo. It creates an input and an output bucket and it creates two settings files.
[deploy.js](scripts/deploy.js)             | Deploys the function to Stedi.
[notification.js](scripts/notification.js) | Enables the notification on the input bucket.
[clean.js](scripts/clean.js)               | Removes the buckets and the function created by this demo.
[settings.js](scripts/settings.js)         | Contains settings used by the helper scripts of this demo: `deploy.js`, `notification.js`, and `clean.js`.
[.env](.env)                               | Contains settings used by the function. These settings are deployed with the function.

## Walkthrough

### Function code

This demo contains a basic function that shows how to retrieve a notification. It reads the contents of the file that was uploaded to the bucket, converts it to uppercase, and writes the result to an output bucket. Check out the [code of the function](src/deploy.js) for a detailed description.

The function writes its output to a different bucket than the one that sends notifications, otherwise it would end up in an infinite loop.

### Testing locally

You can test the function on your local machine before you deploy it. However, the buckets should exist before you do so. The [setup script](scripts/setup,js) will take care of this for you.

```console
node scripts/setup.js
```

Stedi Buckets can’t send a notification to your local machine, so we have to simulate an incoming notification. The [code of the local test script](src/local.js) explains how this is done.

The local test script simulates the creation of a file called `README.md`. You should upload that file to the input bucket, or the function won’t be able to read it. You can do this with the Stedi CLI, which was installed along with the other dependencies for this demo. There’s a catch, though: you need to know the name of the input bucket. Since bucket names need to be globally unique, the setup script generated a name specially for you. Fortunately, it wrote the name to the [settings file](scripts/settings.js#L12). Uploading the file looks something like this, but remember that you need to change the bucket name.

```console
npx stedi buckets put-object -b file://test/local.txt -k local.txt -n demo-notification-input
```

You can use the [Buckets UI](https://www.stedi.com/app/buckets) to verify the file has been uploaded.

[TODO]: # (Replace link to Buckets UI with a CLI command to list the contents of a bucket once that has been added to the CLI. There’s an issue requesting to add it: https://github.com/Stedi/cloud/issues/536)

Now you can run the test.

```console
node scripts/local.js
```

This should process the file you just uploaded. You can use the [Buckets UI](https://www.stedi.com/app/buckets) to look in the output bucket. If you’re not sure what the name of the output bucket is, take look in [.env](.env).

In case you’re wondering why the names of the input and output buckets are in different files, here’s the deal. `.env` contains only those settings that are used by the function, including the name of the output bucket. `settings.js` contains the settings that are used by the scripts in the `scripts` directory. This also includes the name of the output bucket, but if we store it in two different places, they may go out of sync, so `settings.js` grabs it from `.env`.

### Deploying the function

All you need to do to deploy the function to Stedi, is run the [deployment script](scripts/deploy.js).

```console
node scripts/deploy.js
```

Okay, that’s bit of a cop out when it comes to explaining things. Let me make it up to you with an entire, separate [tutorial about deploying functions](https://github.com/Stedi-Demos/deploy-functions-with-the-sdk).

### Setting up the notification

To connect the bucket and the function, you have to add the notification configuration to the bucket. That configuration looks something like this.

```javascript
notifications: {
  functions: [{
    functionName: functionName
  }]
}
```

If that looks like a lot of ceremony for what’s essentially just a function name, you should know that we plan to add more notification options in the future.

The notification script sets up the notification on the bucket. When you add a notification to an existing bucket, you need to take care that you don’t erase the notification settings that are already there. The [code of the notification script](scripts/notification.js) contains a detailed description.

```console
node scripts/notification.js
```

### Testing the deployed function

If you upload a file to the input bucket, you’ll trigger the function. Remember to change the bucket name.

```console
npx stedi buckets put-object -b file://test/deployed.txt -k deployed.txt -n demo-notification-input
```

Use the [Buckets UI](https://www.stedi.com/app/buckets) to see the result in the output bucket.

[TODO]: # (Add a link to a tutorial explaining how to debug a deployed function. Also TODO: write that tutorial.)

### Cleaning up

To delete the buckets and the function:

```console
node scripts/clean.js
```