import React, { useEffect, useState } from "react";
import { db } from "./db";
import type { Deck, Card } from "./db";
import { resizeImageBlob } from "./image";

type Screen =
  | { name: "home" }
  | { name: "decks" }
  | { name: "deck"; deckId: number }
  | { name: "random"; deckId?: number; count: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [decks, setDecks] = useState<Deck[]>([]);

  async function refreshDecks() {
    const d = await db.decks.orderBy("createdAt").reverse().toArray();
    setDecks(d);
  }

  useEffect(() => {
    void refreshDecks();
  }, []);

  // ---------- ROUTES ----------
  if (screen.name === "home") {
    return (
      <Page>
        <TopTitle title="My Knowledge Flashcards" subtitle={formatDateVN(new Date())} />

        <Grid>
          <BigCard
            icon="📚"
            title="Decks"
            desc={`Bạn có ${decks.length} deck`}
            primaryLabel="Quản lý deck"
            onPrimary={() => setScreen({ name: "decks" })}
            secondaryLabel={decks.length ? "Mở deck gần nhất" : undefined}
            onSecondary={
              decks.length
                ? () => setScreen({ name: "deck", deckId: decks[0].id! })
                : undefined
            }
          />

          <RandomCard
            decks={decks}
            onStart={(count, deckId) => setScreen({ name: "random", count, deckId })}
          />
        </Grid>

        <SectionTitle>Deck của bạn</SectionTitle>
        {decks.length === 0 ? (
          <HintBox>
            Chưa có deck nào. Vào <b>Decks</b> để tạo deck và import ảnh.
          </HintBox>
        ) : (
          <List>
            {decks.slice(0, 6).map((d) => (
              <ListItem
                key={d.id}
                title={d.name}
                subtitle="Mở deck để import ảnh / gán mặt 2"
                right="›"
                onClick={() => setScreen({ name: "deck", deckId: d.id! })}
              />
            ))}
            {decks.length > 6 && <SmallMuted>Đang hiển thị 6 deck gần nhất.</SmallMuted>}
          </List>
        )}
      </Page>
    );
  }

  if (screen.name === "decks") {
    return (
      <DecksScreen
        decks={decks}
        onBack={() => setScreen({ name: "home" })}
        onOpenDeck={(id) => setScreen({ name: "deck", deckId: id })}
        onRefresh={refreshDecks}
      />
    );
  }

  if (screen.name === "deck") {
    return (
      <DeckDetailScreen
        deckId={screen.deckId}
        onBack={() => setScreen({ name: "home" })}
        onStartRandom={(count) => setScreen({ name: "random", deckId: screen.deckId, count })}
      />
    );
  }

  if (screen.name === "random") {
    return (
      <RandomScreen
        deckId={screen.deckId}
        count={screen.count}
        onBack={() => setScreen({ name: "home" })}
      />
    );
  }

  return null;
}

/* =========================
   Screens
========================= */

function DecksScreen({
  decks,
  onBack,
  onOpenDeck,
  onRefresh
}: {
  decks: Deck[];
  onBack: () => void;
  onOpenDeck: (deckId: number) => void;
  onRefresh: () => Promise<void>;
}) {
  async function createDeck() {
    const name = prompt("Tên deck?");
    if (!name?.trim()) return;
    await db.decks.add({ name: name.trim(), createdAt: Date.now() });
    await onRefresh();
  }

  async function deleteDeck(deckId: number, name: string) {
    const ok = confirm(`Xoá deck "${name}" và toàn bộ thẻ bên trong?`);
    if (!ok) return;

    await db.transaction("rw", db.decks, db.cards, async () => {
      await db.cards.where({ deckId }).delete();
      await db.decks.delete(deckId);
    });

    await onRefresh();
    alert("Đã xoá deck.");
  }

  return (
    <Page>
      <TopBar
        left={<IconButton label="← Home" onClick={onBack} />}
        center={<BarTitle>Decks</BarTitle>}
        right={<IconButton label="+ New" onClick={() => void createDeck()} />}
      />

      <SectionTitle>Danh sách deck</SectionTitle>
      {decks.length === 0 ? (
        <HintBox>Chưa có deck nào. Bấm <b>+ New</b> để tạo deck.</HintBox>
      ) : (
        <List>
          {decks.map((d) => (
            <CardShell key={d.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 900 }}>{d.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Tap Open để vào deck</div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" onClick={() => onOpenDeck(d.id!)}>
                    Open
                  </button>
                  <button className="btn danger" onClick={() => void deleteDeck(d.id!, d.name)}>
                    Delete
                  </button>
                </div>
              </div>
            </CardShell>
          ))}
        </List>
      )}
    </Page>
  );
}

function DeckDetailScreen({
  deckId,
  onBack,
  onStartRandom
}: {
  deckId: number;
  onBack: () => void;
  onStartRandom: (count: number) => void;
}) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);

  async function load() {
    const d = await db.decks.get(deckId);
    setDeck(d ?? null);

    const list = await db.cards.where({ deckId }).sortBy("createdAt");
    setCards(list.reverse());
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  async function importFront(files: FileList | null) {
    if (!files || files.length === 0) return;
    const now = Date.now();

    const toAdd: any[] = [];
    for (const f of Array.from(files)) {
      const front = await resizeImageBlob(f, 1280, 0.82);
      toAdd.push({
        deckId,
        frontImage: front as Blob,
        backImage: null,
        createdAt: now,
        lastSeenAt: 0
      });
    }

    await db.cards.bulkAdd(toAdd);
    await load();
    alert(`Đã import ${files.length} ảnh mặt 1 (FRONT).`);
  }

  async function assignBack(files: FileList | null) {
    if (!files || files.length === 0) return;

    const orderedOldToNew = (await db.cards.where({ deckId }).sortBy("createdAt")) as Card[];
    const filesArr = Array.from(files);
    const n = Math.min(orderedOldToNew.length, filesArr.length);

    for (let i = 0; i < n; i++) {
      const c = orderedOldToNew[i];
      const back = await resizeImageBlob(filesArr[i], 1280, 0.82);
      await db.cards.update((c as any).id, { backImage: back });
    }

    await load();
    alert(`Đã gán ${n} ảnh mặt 2 (BACK).`);
  }

  async function deleteCard(card: Card) {
    const ok = confirm("Xoá thẻ này?");
    if (!ok) return;
    const id = (card as any).id;
    if (!id) return;
    await db.cards.delete(id);
    await load();
  }

  return (
    <Page>
      <TopBar
        left={<IconButton label="← Home" onClick={onBack} />}
        center={<BarTitle>{deck?.name ?? "Deck"}</BarTitle>}
        right={<span />}
      />

      <Grid>
        <SmallCard title="Tổng thẻ" value={String(cards.length)} />
      </Grid>

      <CardShell>
        <Row>
          <PrimaryButton onClick={() => onStartRandom(Math.min(10, Math.max(cards.length, 1)))}>
            🎲 Random 10
          </PrimaryButton>
          <GhostButton onClick={() => onStartRandom(cards.length || 1)}>🎲 Random All</GhostButton>
        </Row>

        <Row style={{ marginTop: 10 }}>
          <FileButton label="📥 Import FRONT (nhiều ảnh)" onFiles={(f) => void importFront(f)} />
          <FileButton label="🧩 Assign BACK (nhiều ảnh)" onFiles={(f) => void assignBack(f)} />
        </Row>

        <SmallMuted style={{ marginTop: 10 }}>
          Tip: Import FRONT trước. Khi có ảnh mặt 2, dùng Assign BACK (gán theo thứ tự ảnh bạn chọn).
        </SmallMuted>
      </CardShell>

      <SectionTitle>Thẻ gần đây</SectionTitle>
      {cards.length === 0 ? (
        <HintBox>Deck này chưa có thẻ. Bấm <b>Import FRONT</b> để thêm ảnh.</HintBox>
      ) : (
        <>
          <ThumbGrid>
            {cards.slice(0, 12).map((c) => (
              <ThumbTile key={(c as any).id} card={c} onDelete={() => void deleteCard(c)} />
            ))}
          </ThumbGrid>
          {cards.length > 12 && <SmallMuted>Đang hiển thị 12 thẻ gần nhất.</SmallMuted>}
        </>
      )}
    </Page>
  );
}

function RandomScreen({
  deckId,
  count,
  onBack
}: {
  deckId?: number;
  count: number;
  onBack: () => void;
}) {
  const [queue, setQueue] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);

  async function loadRandom() {
    let all: Card[] = [];
    if (deckId) all = await db.cards.where({ deckId }).toArray();
    else all = await db.cards.toArray();

    if (all.length === 0) {
      setQueue([]);
      setIdx(0);
      setShowBack(false);
      return;
    }

    all.sort((a, b) => ((a as any).lastSeenAt ?? 0) - ((b as any).lastSeenAt ?? 0));

    const poolSize = Math.min(all.length, Math.max(count * 4, 20));
    const pool = all.slice(0, poolSize);
    pool.sort(() => Math.random() - 0.5);

    const picked = pool.slice(0, Math.min(count, pool.length));
    setQueue(picked);
    setIdx(0);
    setShowBack(false);
  }

  useEffect(() => {
    void loadRandom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, count]);

  const current = queue[idx];

  async function next() {
    const id = current ? (current as any).id : null;
    if (id) await db.cards.update(id, { lastSeenAt: Date.now() });
    setIdx((v) => v + 1);
    setShowBack(false);
  }

  return (
    <Page>
      <TopBar
        left={<IconButton label="← Home" onClick={onBack} />}
        center={<BarTitle>Random • {count}</BarTitle>}
        right={<IconButton label="↻ Reroll" onClick={() => void loadRandom()} />}
      />

      {!current ? (
        <HintBox>Chưa có thẻ để random. Hãy vào Deck import ảnh mặt 1 trước nhé.</HintBox>
      ) : (
        <>
          <ProgressPill>
            {idx + 1} / {queue.length}
          </ProgressPill>

          <FlipCard
            front={(current as any).frontImage}
            back={(current as any).backImage}
            showBack={showBack}
            onToggle={() => setShowBack((v) => !v)}
          />

          <Row style={{ marginTop: 12 }}>
            <PrimaryButton onClick={() => void next()}>Next</PrimaryButton>
          </Row>
        </>
      )}
    </Page>
  );
}

/* =========================
   Components
========================= */

function RandomCard({
  decks,
  onStart
}: {
  decks: Deck[];
  onStart: (count: number, deckId?: number) => void;
}) {
  const [countStr, setCountStr] = useState<"5" | "10" | "20">("10");
  const [deckIdStr, setDeckIdStr] = useState<string>("all");

  function startWithSelectedCount() {
    const count = Number(countStr);
    const deckId = deckIdStr === "all" ? undefined : Number(deckIdStr);
    onStart(count, deckId);
  }

  async function startRandomAll() {
    const deckId = deckIdStr === "all" ? undefined : Number(deckIdStr);
    const total = deckId ? await db.cards.where({ deckId }).count() : await db.cards.count();
    onStart(Math.max(total, 1), deckId);
  }

  return (
    <BigCard
      icon="🎲"
      title="Knowledge Mode"
      desc="Xem ngẫu nhiên để nhắc lại kho kiến thức"
      customBody={
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          <FieldRow label="Số thẻ">
            <Select
              value={countStr}
              onChange={(e) => setCountStr(e.target.value as "5" | "10" | "20")}
              options={[
                { value: "5", label: "5" },
                { value: "10", label: "10" },
                { value: "20", label: "20" }
              ]}
            />
          </FieldRow>

          <FieldRow label="Deck">
            <Select
              value={deckIdStr}
              onChange={(e) => setDeckIdStr(e.target.value)}
              options={[
                { value: "all", label: "All" },
                ...decks.map((d) => ({ value: String(d.id!), label: d.name }))
              ]}
            />
          </FieldRow>
        </div>
      }
      primaryLabel={`Bắt đầu random (${countStr})`}
      onPrimary={startWithSelectedCount}
      secondaryLabel="Random All"
      onSecondary={() => void startRandomAll()}
    />
  );
}

function FlipCard({
  front,
  back,
  showBack,
  onToggle
}: {
  front: Blob;
  back: Blob | null;
  showBack: boolean;
  onToggle: () => void;
}) {
  const [frontSrc, setFrontSrc] = useState<string | null>(null);
  const [backSrc, setBackSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const f = isValidBlob(front) ? await blobToDataUrl(front) : null;
      const b = isValidBlob(back) ? await blobToDataUrl(back) : null;
      if (cancelled) return;
      setFrontSrc(f);
      setBackSrc(b);
    })();

    return () => {
      cancelled = true;
    };
  }, [front, back]);

  return (
    <CardShell onClick={onToggle} style={{ cursor: "pointer" }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
          {!showBack ? (
            frontSrc ? (
              <img src={frontSrc} style={{ width: "100%", display: "block" }} />
            ) : (
              <Placeholder>Không có ảnh mặt 1</Placeholder>
            )
          ) : backSrc ? (
            <img src={backSrc} style={{ width: "100%", display: "block" }} />
          ) : (
            <Placeholder>Chưa có ảnh mặt 2 (Back). Vào Deck để Assign BACK.</Placeholder>
          )}
        </div>

        <SmallMuted>Tap để {showBack ? "quay lại" : "lật thẻ"}</SmallMuted>
      </div>
    </CardShell>
  );
}

function ThumbTile({ card, onDelete }: { card: Card; onDelete: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const front = (card as any).frontImage;
      const s = isValidBlob(front) ? await blobToDataUrl(front) : null;
      if (!cancelled) setSrc(s);
    })();

    return () => {
      cancelled = true;
    };
  }, [card]);

  return (
    <div style={thumbStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <SmallMuted>Card</SmallMuted>
        <button
          className="btn danger"
          style={{ padding: "6px 10px", borderRadius: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          🗑
        </button>
      </div>

      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
        {src ? <img src={src} style={{ width: "100%", display: "block" }} /> : <Placeholder>no image</Placeholder>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <SmallMuted>Back</SmallMuted>
        <SmallMuted>{(card as any).backImage ? "✅" : "❌"}</SmallMuted>
      </div>
    </div>
  );
}

function FileButton({ label, onFiles }: { label: string; onFiles: (files: FileList | null) => void }) {
  return (
    <label style={fileBtnStyle}>
      {label}
      <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
    </label>
  );
}

function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={onChange} style={selectStyle}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 10 }}>
      <SmallMuted>{label}</SmallMuted>
      {children}
    </div>
  );
}

/* =========================
   UI primitives
========================= */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={pageStyle}>
      <style>{baseCss}</style>
      {children}
    </div>
  );
}

function TopTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.2 }}>{title}</div>
      {subtitle && <div style={{ marginTop: 4, opacity: 0.65, fontSize: 13 }}>{subtitle}</div>}
    </div>
  );
}

function TopBar({ left, center, right }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={topBarStyle}>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  );
}

function BarTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 800, letterSpacing: -0.2 }}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, marginBottom: 10, fontSize: 14, fontWeight: 800, opacity: 0.85 }}>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>{children}</div>;
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 10 }}>{children}</div>;
}

function ListItem({
  title,
  subtitle,
  right,
  onClick
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={listItemStyle}>
      <div style={{ display: "grid", gap: 2 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, opacity: 0.65 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ opacity: 0.45, fontSize: 18 }}>{right}</div>}
    </div>
  );
}

function BigCard({
  icon,
  title,
  desc,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  customBody
}: {
  icon: string;
  title: string;
  desc: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  customBody?: React.ReactNode;
}) {
  return (
    <CardShell>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={iconBadgeStyle}>{icon}</div>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>{desc}</div>
          </div>
        </div>

        {customBody}

        <Row>
          <PrimaryButton onClick={onPrimary}>{primaryLabel}</PrimaryButton>
          {secondaryLabel && onSecondary && <GhostButton onClick={onSecondary}>{secondaryLabel}</GhostButton>}
        </Row>
      </div>
    </CardShell>
  );
}

function SmallCard({ title, value }: { title: string; value: string }) {
  return (
    <CardShell>
      <div style={{ display: "grid", gap: 6 }}>
        <SmallMuted>{title}</SmallMuted>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
      </div>
    </CardShell>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", ...style }}>
      {children}
    </div>
  );
}

function HintBox({ children }: { children: React.ReactNode }) {
  return <div style={hintStyle}>{children}</div>;
}

function ProgressPill({ children }: { children: React.ReactNode }) {
  return <div style={pillStyle}>{children}</div>;
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div style={placeholderStyle}>{children}</div>;
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="btn ghost" onClick={onClick} style={{ padding: "8px 10px" }}>
      {label}
    </button>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="btn primary" onClick={onClick} style={{ flex: 1, minWidth: 140 }}>
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="btn ghost" onClick={onClick} style={{ flex: 1, minWidth: 120 }}>
      {children}
    </button>
  );
}

function CardShell({
  children,
  onClick,
  style
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div onClick={onClick} style={{ ...cardStyle, ...style }}>
      {children}
    </div>
  );
}

/* =========================
   Helpers
========================= */

function blobToDataUrl(blob: Blob | null | undefined): Promise<string | null> {
  return new Promise((resolve) => {
    if (!blob) return resolve(null);
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
}

function isValidBlob(b: any): b is Blob {
  return b && typeof b === "object" && typeof b.size === "number" && b.size > 0;
}

function formatDateVN(d: Date) {
  const weekdays = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const w = weekdays[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${w} • ${dd}/${mm}/${yyyy}`;
}

/* =========================
   Styles
========================= */

const baseCss = `
  :root { color-scheme: light; }
  body { margin: 0; background: #f6f7fb; }
  * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
  .btn { border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 12px 14px; font-weight: 800; cursor: pointer; }
  .btn:active { transform: translateY(1px); }
  .primary { background: #111827; color: white; }
  .ghost { background: white; color: #111827; }
  .danger { background: #fff; color: #b91c1c; border-color: rgba(185,28,28,0.25); }
`;

const pageStyle: React.CSSProperties = { padding: 16, maxWidth: 760, margin: "0 auto" };

const topBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 10,
  marginBottom: 10
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 8px 24px rgba(17,24,39,0.06)"
};

const iconBadgeStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(17,24,39,0.06)",
  fontSize: 20
};

const listItemStyle: React.CSSProperties = {
  ...cardStyle,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer"
};

const hintStyle: React.CSSProperties = { ...cardStyle, background: "rgba(255,255,255,0.85)", borderStyle: "dashed" };

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(17,24,39,0.06)",
  fontSize: 12,
  fontWeight: 800,
  color: "#111827",
  width: "fit-content",
  marginBottom: 10
};

const placeholderStyle: React.CSSProperties = { padding: 20, textAlign: "center", opacity: 0.7 };

const fileBtnStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: "12px 14px",
  background: "white",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center"
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "white",
  fontWeight: 800
};

const thumbStyle: React.CSSProperties = { ...cardStyle, padding: 10 };

const ThumbGrid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>{children}</div>
);

function SmallMuted({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, opacity: 0.65, ...style }}>{children}</div>;
}
