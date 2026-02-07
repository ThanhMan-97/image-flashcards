import Dexie from "dexie";

export type Deck = {
  id?: number;
  name: string;
  createdAt: number;
};

export type Card = {
  id?: number;
  deckId: number;

  frontImage: Blob;
  backImage: Blob | null;

  intervalDays: number;
  dueAt: number;

  lastSeenAt?: number;

  createdAt: number;
};

class AppDB extends Dexie {
  decks!: Dexie.Table<Deck, number>;
  cards!: Dexie.Table<Card, number>;

  constructor() {
    super("image_flashcards_db");

    this.version(1).stores({
      decks: "++id, name, createdAt",
      cards: "++id, deckId, dueAt, createdAt, lastSeenAt"
    });
  }
}

export const db = new AppDB();
