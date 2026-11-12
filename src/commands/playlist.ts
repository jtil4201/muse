import {SlashCommandBuilder} from '@discordjs/builders';
import {APIEmbedField, AutocompleteInteraction, ChatInputCommandInteraction} from 'discord.js';
import {inject, injectable} from 'inversify';
import {Pagination} from 'pagination.djs';
import Command from './index.js';
import AddQueryToQueue from '../services/add-query-to-queue.js';
import GetSongs from '../services/get-songs.js';
import {MediaSource, SongMetadata} from '../services/player-types.js';
import {TYPES} from '../types.js';
import {prisma} from '../utils/db.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';
import {truncate} from '../utils/string.js';

const MAX_NAME_LENGTH = 100;
const MAX_SONGS = 100;
const MAX_PLAYLISTS = 25;

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('your personal, private music playlists')
    .addSubcommand(subcommand => subcommand
      .setName('create')
      .setDescription('create a new playlist')
      .addStringOption(option => option
        .setName('name').setDescription('name of the playlist')
        .setMinLength(1).setMaxLength(MAX_NAME_LENGTH).setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('add')
      .setDescription('add a song to one of your playlists')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true))
      .addStringOption(option => option
        .setName('song').setDescription('song name or a YouTube/Spotify/SoundCloud link')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('remove a song from one of your playlists')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true))
      .addStringOption(option => option
        .setName('song').setDescription('song to remove')
        .setRequired(true).setAutocomplete(true)))
    .addSubcommand(subcommand => subcommand
      .setName('play')
      .setDescription('queue up one of your (or a shared) playlists')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true))
      .addBooleanOption(option => option
        .setName('shuffle').setDescription('shuffle the playlist')))
    .addSubcommand(subcommand => subcommand
      .setName('view')
      .setDescription('see the songs in a playlist')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true)))
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('list your playlists (and ones shared with you)'))
    .addSubcommand(subcommand => subcommand
      .setName('delete')
      .setDescription('delete one of your playlists')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true)))
    .addSubcommand(subcommand => subcommand
      .setName('rename')
      .setDescription('rename one of your playlists')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true))
      .addStringOption(option => option
        .setName('new-name').setDescription('the new name')
        .setMinLength(1).setMaxLength(MAX_NAME_LENGTH).setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('share')
      .setDescription('let someone else play one of your playlists')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true))
      .addUserOption(option => option
        .setName('person').setDescription('who to share it with').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('unshare')
      .setDescription('stop sharing a playlist with someone')
      .addStringOption(option => option
        .setName('name').setDescription('which playlist')
        .setRequired(true).setAutocomplete(true))
      .addUserOption(option => option
        .setName('person').setDescription('who to stop sharing with').setRequired(true)));

  constructor(
    @inject(TYPES.Services.AddQueryToQueue) private readonly addQueryToQueue: AddQueryToQueue,
    @inject(TYPES.Services.GetSongs) private readonly getSongs: GetSongs,
  ) {}

  requiresVC = (interaction: ChatInputCommandInteraction) => interaction.options.getSubcommand() === 'play';

  async execute(interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
      case 'create': await this.create(interaction); break;
      case 'add': await this.add(interaction); break;
      case 'remove': await this.remove(interaction); break;
      case 'play': await this.play(interaction); break;
      case 'view': await this.view(interaction); break;
      case 'list': await this.list(interaction); break;
      case 'delete': await this.delete(interaction); break;
      case 'rename': await this.rename(interaction); break;
      case 'share': await this.share(interaction); break;
      case 'unshare': await this.unshare(interaction); break;
      default: throw new Error('unknown subcommand');
    }
  }

  async handleAutocompleteInteraction(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    if (focused.name === 'song') {
      // Suggest songs from the chosen playlist (remove)
      const playlistName = interaction.options.getString('name')?.trim() ?? '';
      const playlist = await prisma.playlist.findFirst({
        where: {ownerId: userId, name: playlistName},
        include: {songs: {orderBy: {position: 'asc'}}},
      });
      const q = focused.value.toLowerCase();
      const songs = (playlist?.songs ?? [])
        .filter(s => s.title.toLowerCase().includes(q))
        .slice(0, 25)
        .map(s => ({name: truncate(`${s.position + 1}. ${s.title}`, 100), value: String(s.id)}));
      await interaction.respond(songs);
      return;
    }

    // Suggest playlist names. Edit actions: own only. play/view: own + shared.
    const q = focused.value.toLowerCase();
    const owned = await prisma.playlist.findMany({where: {ownerId: userId}});
    let names = owned.map(p => ({name: p.name, value: p.name}));

    if (subcommand === 'play' || subcommand === 'view') {
      const shared = await prisma.playlistShare.findMany({
        where: {sharedWithId: userId},
        include: {playlist: true},
      });
      names = names.concat(shared.map(s => ({name: `${s.playlist.name} (shared)`, value: s.playlist.name})));
    }

    const trimmed = names.filter(n => n.value.toLowerCase().includes(q)).slice(0, 25);
    await interaction.respond(trimmed);
  }

  private async getOwnedPlaylist(interaction: ChatInputCommandInteraction, name: string) {
    const playlist = await prisma.playlist.findFirst({where: {ownerId: interaction.user.id, name}});
    if (!playlist) {
      throw new Error('you don\'t have a playlist with that name');
    }

    return playlist;
  }

  private async create(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      throw new Error(`playlist name must be between 1 and ${MAX_NAME_LENGTH} characters`);
    }

    const count = await prisma.playlist.count({where: {ownerId: interaction.user.id}});
    if (count >= MAX_PLAYLISTS) {
      throw new Error(`you can have at most ${MAX_PLAYLISTS} playlists`);
    }

    const existing = await prisma.playlist.findFirst({where: {ownerId: interaction.user.id, name}});
    if (existing) {
      throw new Error('you already have a playlist with that name');
    }

    await prisma.playlist.create({data: {ownerId: interaction.user.id, name}});
    await interaction.reply({content: `👍 created playlist **${truncate(name, 100)}**`, ephemeral: true});
  }

  private async add(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const query = interaction.options.getString('song')!.trim();
    const playlist = await this.getOwnedPlaylist(interaction, name);

    const existingCount = await prisma.playlistSong.count({where: {playlistId: playlist.id}});
    if (existingCount >= MAX_SONGS) {
      throw new Error(`that playlist is full (max ${MAX_SONGS} songs)`);
    }

    await interaction.deferReply({ephemeral: true});

    const {playlistLimit} = await getGuildSettings(interaction.guild!.id);
    const [songs] = await this.getSongs.getSongs(query, playlistLimit, false);
    if (songs.length === 0) {
      throw new Error('couldn\'t find anything for that');
    }

    const room = MAX_SONGS - existingCount;
    const toAdd = songs.slice(0, room);

    await prisma.$transaction(toAdd.map((song, i) => prisma.playlistSong.create({
      data: {
        playlistId: playlist.id,
        position: existingCount + i,
        title: song.title,
        artist: song.artist ?? '',
        url: song.url,
        source: song.source,
        length: song.length ?? 0,
        thumbnail: song.thumbnailUrl ?? null,
        query,
      },
    })));

    const msg = toAdd.length === 1
      ? `👍 added **${truncate(toAdd[0].title, 100)}** to **${truncate(name, 100)}**`
      : `👍 added **${toAdd.length}** songs to **${truncate(name, 100)}**`;
    await interaction.editReply(msg);
  }

  private async remove(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const songRef = interaction.options.getString('song')!.trim();
    const playlist = await this.getOwnedPlaylist(interaction, name);

    const songs = await prisma.playlistSong.findMany({where: {playlistId: playlist.id}, orderBy: {position: 'asc'}});
    let target = songs.find(s => String(s.id) === songRef);
    target ??= songs.find(s => s.title.toLowerCase() === songRef.toLowerCase());
    target ??= songs.find(s => s.title.toLowerCase().includes(songRef.toLowerCase()));
    if (!target) {
      throw new Error('couldn\'t find that song in the playlist');
    }

    await prisma.playlistSong.delete({where: {id: target.id}});

    // Re-pack positions so they stay contiguous.
    const remaining = songs.filter(s => s.id !== target!.id);
    await prisma.$transaction(remaining.map((s, i) => prisma.playlistSong.update({where: {id: s.id}, data: {position: i}})));

    await interaction.reply({content: `👍 removed **${truncate(target.title, 100)}** from **${truncate(name, 100)}**`, ephemeral: true});
  }

  private async resolvePlaylistForPlayback(interaction: ChatInputCommandInteraction, name: string) {
    // Own playlist, or one shared with the caller.
    let playlist = await prisma.playlist.findFirst({
      where: {ownerId: interaction.user.id, name},
      include: {songs: {orderBy: {position: 'asc'}}},
    });

    if (!playlist) {
      const share = await prisma.playlistShare.findFirst({
        where: {sharedWithId: interaction.user.id, playlist: {name}},
        include: {playlist: {include: {songs: {orderBy: {position: 'asc'}}}}},
      });
      playlist = share?.playlist ?? null;
    }

    return playlist;
  }

  private async play(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const playlist = await this.resolvePlaylistForPlayback(interaction, name);
    if (!playlist) {
      throw new Error('no playlist with that name (that you can access)');
    }

    if (playlist.songs.length === 0) {
      throw new Error('that playlist is empty');
    }

    const songs: SongMetadata[] = playlist.songs.map(s => ({
      title: s.title,
      artist: s.artist,
      url: s.url,
      length: s.length,
      offset: 0,
      playlist: null,
      isLive: false,
      thumbnailUrl: s.thumbnail,
      source: s.source as MediaSource,
    }));

    await this.addQueryToQueue.addResolvedSongsToQueue({
      songs,
      interaction,
      label: `playlist **${truncate(name, 100)}**`,
      shuffleAdditions: interaction.options.getBoolean('shuffle') ?? false,
    });
  }

  private async view(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const playlist = await this.resolvePlaylistForPlayback(interaction, name);
    if (!playlist) {
      throw new Error('no playlist with that name (that you can access)');
    }

    if (playlist.songs.length === 0) {
      await interaction.reply({content: `**${truncate(name, 100)}** is empty. Add songs with /playlist add.`, ephemeral: true});
      return;
    }

    const fields = new Array<APIEmbedField>(playlist.songs.length);
    for (let i = 0; i < playlist.songs.length; i++) {
      fields[i] = {
        inline: false,
        name: `${i + 1}. ${truncate(playlist.songs[i].title, 240)}`,
        value: playlist.songs[i].artist ? truncate(playlist.songs[i].artist, 1024) : '​',
      };
    }

    await new Pagination(interaction as ChatInputCommandInteraction<'cached'>, {ephemeral: true, limit: 10})
      .setFields(fields)
      .paginateFields(true)
      .render();
  }

  private async list(interaction: ChatInputCommandInteraction) {
    const owned = await prisma.playlist.findMany({
      where: {ownerId: interaction.user.id},
      include: {_count: {select: {songs: true}}},
    });
    const shared = await prisma.playlistShare.findMany({
      where: {sharedWithId: interaction.user.id},
      include: {playlist: {include: {_count: {select: {songs: true}}}}},
    });

    if (owned.length === 0 && shared.length === 0) {
      await interaction.reply({content: 'you don\'t have any playlists yet. Make one with /playlist create.', ephemeral: true});
      return;
    }

    const lines: string[] = [];
    if (owned.length > 0) {
      lines.push('**Your playlists**');
      for (const p of owned) {
        lines.push(`• ${truncate(p.name, 100)} — ${p._count.songs} song${p._count.songs === 1 ? '' : 's'}`);
      }
    }

    if (shared.length > 0) {
      lines.push('', '**Shared with you**');
      for (const s of shared) {
        lines.push(`• ${truncate(s.playlist.name, 100)} — ${s.playlist._count.songs} songs (from <@${s.playlist.ownerId}>)`);
      }
    }

    await interaction.reply({content: lines.join('\n'), ephemeral: true, allowedMentions: {parse: []}});
  }

  private async delete(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const playlist = await this.getOwnedPlaylist(interaction, name);
    await prisma.playlist.delete({where: {id: playlist.id}});
    await interaction.reply({content: `🗑️ deleted playlist **${truncate(name, 100)}**`, ephemeral: true});
  }

  private async rename(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const newName = interaction.options.getString('new-name')!.trim();
    if (newName.length === 0 || newName.length > MAX_NAME_LENGTH) {
      throw new Error(`playlist name must be between 1 and ${MAX_NAME_LENGTH} characters`);
    }

    const playlist = await this.getOwnedPlaylist(interaction, name);
    const clash = await prisma.playlist.findFirst({where: {ownerId: interaction.user.id, name: newName}});
    if (clash) {
      throw new Error('you already have a playlist with that name');
    }

    await prisma.playlist.update({where: {id: playlist.id}, data: {name: newName}});
    await interaction.reply({content: `👍 renamed to **${truncate(newName, 100)}**`, ephemeral: true});
  }

  private async share(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const person = interaction.options.getUser('person', true);
    const playlist = await this.getOwnedPlaylist(interaction, name);

    if (person.id === interaction.user.id) {
      throw new Error('that playlist is already yours');
    }

    if (person.bot) {
      throw new Error('you can\'t share a playlist with a bot');
    }

    await prisma.playlistShare.upsert({
      where: {playlistId_sharedWithId: {playlistId: playlist.id, sharedWithId: person.id}},
      update: {},
      create: {playlistId: playlist.id, sharedWithId: person.id},
    });

    await interaction.reply({content: `👍 shared **${truncate(name, 100)}** with <@${person.id}> — they can now play it`, ephemeral: true, allowedMentions: {parse: []}});
  }

  private async unshare(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name')!.trim();
    const person = interaction.options.getUser('person', true);
    const playlist = await this.getOwnedPlaylist(interaction, name);

    await prisma.playlistShare.deleteMany({where: {playlistId: playlist.id, sharedWithId: person.id}});
    await interaction.reply({content: `👍 stopped sharing **${truncate(name, 100)}** with <@${person.id}>`, ephemeral: true, allowedMentions: {parse: []}});
  }
}
