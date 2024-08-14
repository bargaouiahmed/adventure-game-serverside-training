const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === "GET" && req.url === "/") {
      const htmlPage = fs.readFileSync('./views/new-player.html', 'utf-8');
      const htmlBody = htmlPage.replace(/#{availableRooms}/g, world.availableRoomsToString());
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(htmlBody);
    }

    // Phase 2: POST /player
    if (req.method === "POST" && req.url === '/player') {
      const name = req.body.name;
      const roomId = req.body.roomId;
      const room = world.rooms[roomId];
      if (room) {
        player = new Player(name, room);
        const startingRoomId = player.currentRoom.id;
        const redirectUrl = `/rooms/${startingRoomId}`;
        res.writeHead(302, { Location: redirectUrl });
        return res.end();
      }
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === "GET" && req.url.startsWith("/rooms/") && req.url.split('/').length === 3) {
      const urlParts = req.url.split('/');
      const roomId = parseInt(urlParts[2]); // Extract the roomId from the URL

      // Ensure player exists
      if (!player) {
        res.writeHead(302, { Location: '/' });
        return res.end();
      }

      // Check if the roomId matches the player's current room
      if (roomId !== player.currentRoom.id) {
        res.writeHead(302, { Location: `/rooms/${player.currentRoom.id}` });
        return res.end();
      }

      // Render the room details
      try {
        const room = player.currentRoom; // Player's current room
        const htmlBody = fs.readFileSync('./views/room.html', 'utf-8');

        // Replace placeholders with actual room details
        const htmlPage = htmlBody
          .replace(/#{roomName}/g, room.name)
          .replace(/#{inventory}/g, player.inventoryToString())
          .replace(/#{roomItems}/g, room.itemsToString())
          .replace(/#{exits}/g, room.exitsToString());

        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(htmlPage);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end(`Error: ${e.message}`);
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === 'GET' && req.url.startsWith('/rooms/') && req.url.split('/').length === 4) {
      const urlParts = req.url.split('/');
      const roomId = parseInt(urlParts[2]);
      const direction = urlParts[3].charAt(0); // Get the first letter of the direction

      // Ensure player exists and is in the specified room
      if (!player || roomId !== player.currentRoom.id) {
        res.writeHead(302, { Location: `/rooms/${player.currentRoom.id}` });
        return res.end();
      }

      try {
        // Move the player to the new room
        player.move(direction);
        const newRoom = player.currentRoom;

        // Redirect to the new room
        res.writeHead(302, { Location: `/rooms/${newRoom.id}` });
        return res.end();
      } catch (e) {
        // Redirect back to the player's current room on error
        res.writeHead(302, { Location: `/rooms/${player.currentRoom.id}` });
        return res.end();
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === 'POST' && req.url.startsWith('/items')) {
      const urlParts = req.url.split('/');
      const itemId = parseInt(urlParts[2]);
      const action = urlParts[3];

      try {
        switch (action) {
          case 'drop':
            player.dropItem(itemId);
            break;
          case 'eat':
            player.eatItem(itemId);
            break;
          case 'take':
            player.takeItem(itemId);
            break;
          default:
            throw new Error(`Invalid action: ${action}`);
        }
        res.writeHead(302, { Location: `/rooms/${player.currentRoom.id}` });
        return res.end();
      } catch (e) {
        // Handle errors, like trying to eat a non-food item
        res.writeHead(302, { Location: `/rooms/${player.currentRoom.id}` });
        return res.end();
      }
    }

    // Phase 6: Redirect if no matching route handlers
    res.writeHead(302, { Location: `/rooms/${player.currentRoom.id}` });
    return res.end();
  });
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
