export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: '14.18';
    };
    graphql_public: {
        Tables: {
            [_ in never]: never;
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            graphql: {
                Args: {
                    extensions?: Json;
                    operationName?: string;
                    query?: string;
                    variables?: Json;
                };
                Returns: Json;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
    public: {
        Tables: {
            plays: {
                Row: {
                    ended_at: string | null;
                    id: number;
                    outcome: Database['public']['Enums']['play_outcome'] | null;
                    picked_by: Database['public']['Enums']['picked_by'];
                    seconds_played: number | null;
                    session_id: number | null;
                    singer_id: number | null;
                    song_id: number | null;
                    started_at: string;
                    video_id: string;
                };
                Insert: {
                    ended_at?: string | null;
                    id?: number;
                    outcome?: Database['public']['Enums']['play_outcome'] | null;
                    picked_by: Database['public']['Enums']['picked_by'];
                    seconds_played?: number | null;
                    session_id?: number | null;
                    singer_id?: number | null;
                    song_id?: number | null;
                    started_at?: string;
                    video_id: string;
                };
                Update: {
                    ended_at?: string | null;
                    id?: number;
                    outcome?: Database['public']['Enums']['play_outcome'] | null;
                    picked_by?: Database['public']['Enums']['picked_by'];
                    seconds_played?: number | null;
                    session_id?: number | null;
                    singer_id?: number | null;
                    song_id?: number | null;
                    started_at?: string;
                    video_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'plays_session_id_fkey';
                        columns: ['session_id'];
                        isOneToOne: false;
                        referencedRelation: 'sessions';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'plays_singer_id_fkey';
                        columns: ['singer_id'];
                        isOneToOne: false;
                        referencedRelation: 'singers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'plays_song_id_fkey';
                        columns: ['song_id'];
                        isOneToOne: false;
                        referencedRelation: 'songs';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'plays_video_id_fkey';
                        columns: ['video_id'];
                        isOneToOne: false;
                        referencedRelation: 'videos';
                        referencedColumns: ['youtube_id'];
                    },
                ];
            };
            queue_items: {
                Row: {
                    added_at: string;
                    id: number;
                    position: number;
                    session_id: number;
                    singer_id: number | null;
                    status: Database['public']['Enums']['queue_status'];
                    video_id: string;
                };
                Insert: {
                    added_at?: string;
                    id?: number;
                    position: number;
                    session_id: number;
                    singer_id?: number | null;
                    status?: Database['public']['Enums']['queue_status'];
                    video_id: string;
                };
                Update: {
                    added_at?: string;
                    id?: number;
                    position?: number;
                    session_id?: number;
                    singer_id?: number | null;
                    status?: Database['public']['Enums']['queue_status'];
                    video_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'queue_items_session_id_fkey';
                        columns: ['session_id'];
                        isOneToOne: false;
                        referencedRelation: 'sessions';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'queue_items_singer_id_fkey';
                        columns: ['singer_id'];
                        isOneToOne: false;
                        referencedRelation: 'singers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'queue_items_video_id_fkey';
                        columns: ['video_id'];
                        isOneToOne: false;
                        referencedRelation: 'videos';
                        referencedColumns: ['youtube_id'];
                    },
                ];
            };
            reactions: {
                Row: {
                    singer_id: number;
                    song_id: number;
                    updated_at: string;
                    value: number;
                };
                Insert: {
                    singer_id: number;
                    song_id: number;
                    updated_at?: string;
                    value: number;
                };
                Update: {
                    singer_id?: number;
                    song_id?: number;
                    updated_at?: string;
                    value?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'reactions_singer_id_fkey';
                        columns: ['singer_id'];
                        isOneToOne: false;
                        referencedRelation: 'singers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'reactions_song_id_fkey';
                        columns: ['song_id'];
                        isOneToOne: false;
                        referencedRelation: 'songs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            sessions: {
                Row: {
                    ended_at: string | null;
                    id: number;
                    name: string | null;
                    started_at: string;
                };
                Insert: {
                    ended_at?: string | null;
                    id?: number;
                    name?: string | null;
                    started_at?: string;
                };
                Update: {
                    ended_at?: string | null;
                    id?: number;
                    name?: string | null;
                    started_at?: string;
                };
                Relationships: [];
            };
            similar_songs: {
                Row: {
                    match: number;
                    similar_song_id: number;
                    song_id: number;
                };
                Insert: {
                    match: number;
                    similar_song_id: number;
                    song_id?: number;
                };
                Update: {
                    match?: number;
                    similar_song_id?: number;
                    song_id?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'similar_songs_similar_song_id_fkey';
                        columns: ['similar_song_id'];
                        isOneToOne: false;
                        referencedRelation: 'songs';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'similar_songs_song_id_fkey';
                        columns: ['song_id'];
                        isOneToOne: true;
                        referencedRelation: 'songs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            singers: {
                Row: {
                    avatar: string | null;
                    created_at: string;
                    id: number;
                    name: string;
                };
                Insert: {
                    avatar?: string | null;
                    created_at?: string;
                    id?: number;
                    name: string;
                };
                Update: {
                    avatar?: string | null;
                    created_at?: string;
                    id?: number;
                    name?: string;
                };
                Relationships: [];
            };
            songs: {
                Row: {
                    artist: string;
                    created_at: string;
                    id: number;
                    lastfm_fetched_at: string | null;
                    lastfm_listeners: number | null;
                    lastfm_playcount: number | null;
                    match_key: string;
                    tags: string[] | null;
                    title: string;
                };
                Insert: {
                    artist?: string;
                    created_at?: string;
                    id?: number;
                    lastfm_fetched_at?: string | null;
                    lastfm_listeners?: number | null;
                    lastfm_playcount?: number | null;
                    match_key?: string;
                    tags?: string[] | null;
                    title?: string;
                };
                Update: {
                    artist?: string;
                    created_at?: string;
                    id?: number;
                    lastfm_fetched_at?: string | null;
                    lastfm_listeners?: number | null;
                    lastfm_playcount?: number | null;
                    match_key?: string;
                    tags?: string[] | null;
                    title?: string;
                };
                Relationships: [];
            };
            sources: {
                Row: {
                    boost: number;
                    channel_title: string | null;
                    enabled: boolean;
                    id: number;
                    last_synced_at: string | null;
                    name: string;
                    youtube_playlist_id: string;
                };
                Insert: {
                    boost?: number;
                    channel_title?: string | null;
                    enabled?: boolean;
                    id?: number;
                    last_synced_at?: string | null;
                    name: string;
                    youtube_playlist_id: string;
                };
                Update: {
                    boost?: number;
                    channel_title?: string | null;
                    enabled?: boolean;
                    id?: number;
                    last_synced_at?: string | null;
                    name?: string;
                    youtube_playlist_id?: string;
                };
                Relationships: [];
            };
            video_sources: {
                Row: {
                    first_seen_at: string;
                    position: number | null;
                    source_id: number;
                    video_id: string;
                };
                Insert: {
                    first_seen_at?: string;
                    position?: number | null;
                    source_id: number;
                    video_id: string;
                };
                Update: {
                    first_seen_at?: string;
                    position?: number | null;
                    source_id?: number;
                    video_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'video_sources_source_id_fkey';
                        columns: ['source_id'];
                        isOneToOne: false;
                        referencedRelation: 'sources';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'video_sources_video_id_fkey';
                        columns: ['video_id'];
                        isOneToOne: false;
                        referencedRelation: 'videos';
                        referencedColumns: ['youtube_id'];
                    },
                ];
            };
            videos: {
                Row: {
                    added_by: number | null;
                    added_via: Database['public']['Enums']['added_via'];
                    channel_id: string;
                    channel_title: string;
                    created_at: string;
                    duration_sec: number | null;
                    last_player_error: number | null;
                    needs_review: boolean;
                    published_at: string | null;
                    raw_title: string;
                    song_id: number | null;
                    stats_fetched_at: string | null;
                    status: Database['public']['Enums']['video_status'];
                    thumbnail_url: string | null;
                    version: Database['public']['Enums']['video_version'];
                    view_count: number | null;
                    youtube_id: string;
                };
                Insert: {
                    added_by?: number | null;
                    added_via: Database['public']['Enums']['added_via'];
                    channel_id?: string;
                    channel_title?: string;
                    created_at?: string;
                    duration_sec?: number | null;
                    last_player_error?: number | null;
                    needs_review?: boolean;
                    published_at?: string | null;
                    raw_title?: string;
                    song_id?: number | null;
                    stats_fetched_at?: string | null;
                    status?: Database['public']['Enums']['video_status'];
                    thumbnail_url?: string | null;
                    version?: Database['public']['Enums']['video_version'];
                    view_count?: number | null;
                    youtube_id: string;
                };
                Update: {
                    added_by?: number | null;
                    added_via?: Database['public']['Enums']['added_via'];
                    channel_id?: string;
                    channel_title?: string;
                    created_at?: string;
                    duration_sec?: number | null;
                    last_player_error?: number | null;
                    needs_review?: boolean;
                    published_at?: string | null;
                    raw_title?: string;
                    song_id?: number | null;
                    stats_fetched_at?: string | null;
                    status?: Database['public']['Enums']['video_status'];
                    thumbnail_url?: string | null;
                    version?: Database['public']['Enums']['video_version'];
                    view_count?: number | null;
                    youtube_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'videos_added_by_fkey';
                        columns: ['added_by'];
                        isOneToOne: false;
                        referencedRelation: 'singers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'videos_song_id_fkey';
                        columns: ['song_id'];
                        isOneToOne: false;
                        referencedRelation: 'songs';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            added_via: 'playlist' | 'manual';
            picked_by: 'queue' | 'autopilot';
            play_outcome: 'completed' | 'skipped' | 'error';
            queue_status: 'queued' | 'playing' | 'done' | 'removed';
            video_status:
                | 'ok'
                | 'not_embeddable'
                | 'region_blocked'
                | 'age_restricted'
                | 'unavailable';
            video_version: 'standard' | 'lower_key' | 'higher_key' | 'duet' | 'other';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            added_via: ['playlist', 'manual'],
            picked_by: ['queue', 'autopilot'],
            play_outcome: ['completed', 'skipped', 'error'],
            queue_status: ['queued', 'playing', 'done', 'removed'],
            video_status: [
                'ok',
                'not_embeddable',
                'region_blocked',
                'age_restricted',
                'unavailable',
            ],
            video_version: ['standard', 'lower_key', 'higher_key', 'duet', 'other'],
        },
    },
} as const;
