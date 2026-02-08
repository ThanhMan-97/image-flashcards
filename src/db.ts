// src/db.ts
import Dexie, { type Table } from "dexie";

export type Deck = {
  id?: number;
  name: string;
  createdAt: number;
};

export type Card = {
  id?: number;
  deckId: number;

  // ✅ lưu dạng string (dataURL) để iOS Safari ổn định
  frontDataUrl: string; // luôn có sau khi import front
  backDataUrl: string | null;

  intervalDays: number;
  dueAt: number;
  createdAt: number;
  lastSeenAt?: number;
};

class AppDB extends Dexie {
  decks!: Table<Deck, number>;
  cards!: Table<Card, number>;

  constructor() {
    super("image-flashcards-db");

    // ✅ version mới: đổi Blob -> string fields
    this.version(2).stores({
      decks: "++id, createdAt",
      cards: "++id, deckId, createdAt, dueAt, lastSeenAt"
    });
  }
}

export const db = new AppDB();
