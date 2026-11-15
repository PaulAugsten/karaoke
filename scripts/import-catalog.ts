/**
 * Imports karaoke videos from YouTube playlists into the catalog.
 * Dry run by default. Pass --persist to write to the database.
 *
 * Usage:
 *  pnpm import:catalog --channel=<handle>  list a channel's playlists
 *  pnpm import:catalog --add=<id or URL>   import these playlists
 *    --title-first                          their titles read "Title - Artist"
 *  pnpm import:catalog                     re-import every enabled source
 */

import {
    fetchEnabledSources,
    markSourceSynced,
    type Source,
    upsertSources,
} from '@/lib/catalog/catalogDb';
import { type ImportResult, importPlaylist } from '@/lib/catalog/importPlaylist';
import { fetchChannelPlaylists, fetchPlaylists } from '@/lib/catalog/youtube';

const MAX_TITLES_SHOWN = 20;

const persist = process.argv.includes('--persist');
/** Only set when given, so re-adding a source keeps its stored order. */
const titleFirst = process.argv.includes('--title-first') ? true : undefined;
const channel = option('channel');
const added = option('add')?.split(',').map(toPlaylistId) ?? [];

function option(name: string): string | undefined {
    return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

/** Accepts a playlist id or any YouTube URL with a list parameter. */
function toPlaylistId(value: string): string {
    const trimmed = value.trim();
    return URL.canParse(trimmed) ? (new URL(trimmed).searchParams.get('list') ?? trimmed) : trimmed;
}

async function listChannel(handle: string) {
    const playlists = await fetchChannelPlaylists(handle);
    for (const playlist of playlists.sort((a, b) => b.itemCount - a.itemCount)) {
        console.log(`${playlist.id} ${String(playlist.itemCount).padStart(5)} ${playlist.title}`);
    }
}

interface Target {
    playlistId: string;
    name: string;
    sourceId: number | null;
    titleFirst: boolean;
}

function toTarget(source: Source): Target {
    return {
        playlistId: source.youtube_playlist_id,
        name: source.name,
        sourceId: source.id,
        titleFirst: source.title_first,
    };
}

/** The playlists to import. */
async function targets(): Promise<Target[]> {
    if (added.length === 0) return (await fetchEnabledSources()).map(toTarget);

    const playlists = await fetchPlaylists(added);
    const missing = added.filter((id) => !playlists.some((playlist) => playlist.id === id));
    if (missing.length > 0) {
        throw new Error(`Playlists not found or private: ${missing.join(', ')}`);
    }
    if (persist) return (await upsertSources(playlists, titleFirst)).map(toTarget);
    return playlists.map((playlist) => ({
        playlistId: playlist.id,
        name: playlist.title,
        sourceId: null,
        titleFirst: titleFirst ?? false,
    }));
}

function report(name: string, result: ImportResult) {
    console.log(
        `${name}: ${result.songs} songs` +
            ` (${result.seen} entries, ${result.skipped} clips/compilations skipped,` +
            ` ${result.unavailable} unavailable, ${result.notPlayable} not playable on the stage)`,
    );
    const unparsed = result.unparsedTitles;
    if (unparsed.length === 0) return;
    console.log(` Needs review, saved without a song (${unparsed.length}):`);
    for (const title of unparsed.slice(0, MAX_TITLES_SHOWN)) console.log(`   ${title}`);
    if (unparsed.length > MAX_TITLES_SHOWN) {
        console.log(`   ...and ${unparsed.length - MAX_TITLES_SHOWN} more`);
    }
}

async function main() {
    if (channel) {
        await listChannel(channel);
        return;
    }

    const playlists = await targets();
    if (playlists.length === 0) {
        console.log('No enabled sources. Add playlists with --add=<id>.');
        return;
    }

    for (const { playlistId, name, sourceId, titleFirst } of playlists) {
        const saveTo = persist ? sourceId : null;
        const result = await importPlaylist(playlistId, saveTo, { titleFirst });
        if (saveTo !== null) await markSourceSynced(saveTo);
        report(name, result);
    }
    if (!persist) console.log('\nDry run: nothing was written. Pass --persist to save.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
