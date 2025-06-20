# Drive-Scraper

This is a Discord bot (can be integrated with other things) that scans for changes made to a drive and sends update notification to a discord cahnnel.

### Who is it for?

- If you're someone working in a group for any type of project, research or study purpose and use a central google drive folder for everyone to share their resources and worked files with everyone then this program can be benificial for you.

### What it is?

- It is a small node.js based program.
- Drive Scraper does exactly what it sounds like. It can scan a **Google Drive Folder** and check for changes made in the folder (_added or removed files_).
- It tracks the changes and sends a text/notification to a discord server channel so all the members sharing the **Google Drive Folder** can be updated about the changes made by anyone in the folder.
- Currently it is in a **Discord Bot** form but it can be deployed in mnany ways.

### How does it work?

- The working process of this program is very straight forward. When we run this program, it will connect to google drive api and discord bot api.
- It will scan the whole folder to create a object using the structure of the folder, then it will store the structure as a _JSON_ file.
- It will rerun after a set amount of time and create another structure and _JSON_ file for the drive folder on current state.
- Then it will compare the old JSON file with the new one and check for changes made.
- If there is no change in both state, I won't do anything and rerun the program after a set duration.
- If it finds any changes between two states of the Drive folder, it will list those changes and send them as discord text. Then it will go on and update the old state with the new state and keep working on like that.

### How to USE this program for your self?

- You need to install node.js with npm to your machine.
- go to your desired location in your computer.
- open terminal/cmd on that location, and paste `git clone https://github.com/SrothJr/Drive-Scraper.git`
- After successful cloning, paste and run in your terminal the following line: <br> `npm install`
- Now navigate through start.js and find the placeholders required keys (_CLIENT_ID, CLIENT_SECRET_KEY, etc_) and populate them with your data.
- Don't forget to add your **DRIVE FOLDER ID** accordingly. (I might add a separate function to get the FOLDER ID by name later on).
- Play with the `setInterval` time settings to optimize it according to your liking.
- Run the program, that's it.
