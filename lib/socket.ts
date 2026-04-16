import { Server } from 'socket.io';

let io: Server;

export function getIO(): Server {
  return io;
}

export function initSocket(server: any): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Restaurant staff joins their room
    socket.on('join_restaurant', (restaurant_id: string) => {
      socket.join(`restaurant_${restaurant_id}`);
      console.log(`Staff joined room: restaurant_${restaurant_id}`);
    });

    // Customer joins their queue room
    socket.on('join_queue', (queue_entry_id: string) => {
      socket.join(`queue_${queue_entry_id}`);
      console.log(`Customer joined queue room: ${queue_entry_id}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

// Emit to all staff of a restaurant
export function emitToRestaurant(restaurant_id: string, event: string, data: any) {
  if (io) {
    io.to(`restaurant_${restaurant_id}`).emit(event, data);
  }
}

// Emit to a specific customer
export function emitToCustomer(queue_entry_id: string, event: string, data: any) {
  if (io) {
    io.to(`queue_${queue_entry_id}`).emit(event, data);
  }
}