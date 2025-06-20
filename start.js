import "dotenv/config"; // Load environment variables from .env file

// Drive Stuff
import { google } from "googleapis";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { writeFile, readFile } from "fs/promises";

import { access } from "fs/promises"; // Import access for checking file existence
import { constants } from "fs"; // Import constants for fs.access modes

// Discord Stuff
import { Client, GatewayIntentBits } from "discord.js";
import { Console } from "console";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth2Client });

//check if the Google Drive API is initialized successfully
async function checkDriveInitialization() {
  try {
    const response = await drive.about.get({
      fields: "user(displayName,emailAddress)", // Requesting minimal fields
    });
    console.log(
      `✅ Google Drive API initialized successfully! Connected as: ${response.data.user.displayName} (${response.data.user.emailAddress})`
    );
    return true;
  } catch (error) {
    console.error("❌ Google Drive API initialization failed!");
    console.error("Error details:", error.message);
    if (error.code === 401 || error.code === 403) {
      // Unauthorized or Forbidden
      console.error(
        "This usually indicates invalid/expired credentials (refresh token, client ID/secret) or insufficient API permissions."
      );
    } else if (
      error.code === 400 &&
      error.errors &&
      error.errors[0].reason === "invalid_client"
    ) {
      console.error(
        "The client_id, client_secret, or redirect_uri used might be incorrect or mismatched with your Google Cloud Console settings."
      );
    }
    return false;
  }
}

// Set up Discord bot
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TARGET_FOLDER_ID = process.env.DOOMED_THESIS_FOLDER_ID;

async function sendDiscordMessage(content) {
  const channel = await discordClient.channels.fetch(CHANNEL_ID);
  if (channel && channel.isTextBased()) {
    await channel.send(content);
  } else {
    console.error("❌ Could not fetch the Discord text channel.");
  }
}

async function buildFolderTree(folderId = "root", folderName = "Root") {
  const folderObject = {
    name: folderName,
    id: folderId,
    files: null,
    subfolders: null,
  };

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
    });

    const files = res.data.files;

    const fileList = [];
    const subfolderList = [];

    for (const file of files) {
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";

      if (isFolder) {
        const subfolder = await buildFolderTree(file.id, file.name);
        subfolderList.push(subfolder);
      } else {
        fileList.push(file.name);
      }
    }

    folderObject.files = fileList.length > 0 ? fileList : null;
    folderObject.subfolders = subfolderList.length > 0 ? subfolderList : null;

    return folderObject;
  } catch (err) {
    console.error("Error building folder tree:", err.message);
    return folderObject;
  }
}

async function saveFolderObjectToFile(
  folderObject,
  fileName = "folderTree.json"
) {
  try {
    const jsonData = JSON.stringify(folderObject, null, 2);
    await writeFile(fileName, jsonData);
    console.log(`✅ Folder structure saved to ${fileName}`); // Added for clarity
  } catch (error) {
    console.error("❌ Error writing JSON file:", error.message);
  }
}

function compareStructures(oldObj, newObj, path = "") {
  const changes = [];

  const currentPath = path ? `${path}/${newObj.name}` : newObj.name;

  // Compare files
  const oldFiles = oldObj?.files || [];
  const newFiles = newObj?.files || [];

  const addedFiles = newFiles.filter((file) => !oldFiles.includes(file));
  const removedFiles = oldFiles.filter((file) => !newFiles.includes(file));

  for (const file of addedFiles) {
    changes.push(`🆕 File added: ${currentPath}/${file}`);
  }
  for (const file of removedFiles) {
    changes.push(`🗑️ File removed: ${currentPath}/${file}`);
  }

  // Compare subfolders
  const oldSub = oldObj?.subfolders || [];
  const newSub = newObj?.subfolders || [];

  const oldMap = Object.fromEntries(oldSub.map((f) => [f.name, f]));
  const newMap = Object.fromEntries(newSub.map((f) => [f.name, f]));

  for (const name of Object.keys(newMap)) {
    if (oldMap[name]) {
      // Recurse into common subfolders
      changes.push(
        ...compareStructures(oldMap[name], newMap[name], currentPath)
      );
    } else {
      changes.push(`🆕 Folder added: ${currentPath}/${name}`);
    }
  }

  for (const name of Object.keys(oldMap)) {
    if (!newMap[name]) {
      changes.push(`🗑️ Folder removed: ${currentPath}/${name}`);
    }
  }

  return changes;
}

async function compareDriveStructures() {
  let oldData;
  const oldFolderPath = "oldFolder.json";

  try {
    await access(oldFolderPath, constants.F_OK); // Check if oldFolder.json exists
    oldData = JSON.parse(await readFile(oldFolderPath, "utf-8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      // File not found
      console.log(
        `ℹ️ ${oldFolderPath} not found. Generating it for the first time.`
      );
      const initialFolderTree = await buildFolderTree(
        TARGET_FOLDER_ID,
        "Doomed Thesis"
      );
      await saveFolderObjectToFile(initialFolderTree, oldFolderPath);
      console.log(
        `✅ Initial ${oldFolderPath} created. No comparison performed yet.`
      );
      return; // Exit as there's nothing to compare on the first run
    } else {
      console.error(`❌ Error accessing ${oldFolderPath}:`, error.message);
      return; // Exit on other errors
    }
  }

  const newData = JSON.parse(await readFile("newFolder.json", "utf-8"));

  const changes = compareStructures(oldData, newData);

  if (changes.length === 0) {
    console.log("✅ No changes detected.");
  } else {
    console.log("🔍 Changes detected:");
    for (const change of changes) {
      await sendDiscordMessage(change);
    }
    fs.copyFile("newFolder.json", "oldFolder.json", (err) => {
      if (err) {
        console.error("❌ Error updating oldFolder.json:", err.message);
      } else {
        console.log("✅ oldFolder.json updated with new structure.");
      }
    });
  }
}

discordClient.once("ready", async () => {
  console.log(`🤖 Logged in as ${discordClient.user.tag}`);
  // Check if Google Drive API is initialized successfully
  const isDriveReady = await checkDriveInitialization();
  if (!isDriveReady) {
    console.error("🚨 Drive API not ready. Aborting further Drive operations.");
    // You might want to exit the process here or disable Drive-related features
    process.exit(1); // comment this if you dont want to exit on failure
    return; // Stop execution if Drive isn't initialized
  }
  // building newFolder.json for comparing
  const newMother = await buildFolderTree(TARGET_FOLDER_ID, "Doomed Thesis");
  await saveFolderObjectToFile(newMother, "newFolder.json");

  await compareDriveStructures(); // This function handles initial file generation and comparison

  setInterval(async () => {
    console.log("🔄 Running scheduled drive structure check..."); // Added for clarity on intervals
    const newMother = await buildFolderTree(TARGET_FOLDER_ID, "Doomed Thesis");
    await saveFolderObjectToFile(newMother, "newFolder.json");
    await compareDriveStructures();
  }, 5 * 1000); // Check every 5 seconds (5 * 1000 = 5000 milliseconds = 5 seconds)
});

discordClient.login(DISCORD_TOKEN);
