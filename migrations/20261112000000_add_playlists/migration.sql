-- CreateTable
CREATE TABLE "Playlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlaylistSong" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "source" INTEGER NOT NULL,
    "length" REAL NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "query" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistSong_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaylistShare" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistId" INTEGER NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistShare_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_ownerId_name_key" ON "Playlist"("ownerId", "name");

-- CreateIndex
CREATE INDEX "PlaylistSong_playlistId_idx" ON "PlaylistSong"("playlistId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistShare_playlistId_sharedWithId_key" ON "PlaylistShare"("playlistId", "sharedWithId");
