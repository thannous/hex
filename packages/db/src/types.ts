export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["role_type"];
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["role_type"];
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["role_type"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_memberships_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      catalogue_items: {
        Row: {
          id: string;
          tenant_id: string;
          hex_code: string;
          designation: string;
          temps_unitaire_h: number | null;
          unite_mesure: string | null;
          dn: string | null;
          pn: string | null;
          matiere: string | null;
          connexion: string | null;
          discipline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          hex_code: string;
          designation: string;
          temps_unitaire_h?: number | null;
          unite_mesure?: string | null;
          dn?: string | null;
          pn?: string | null;
          matiere?: string | null;
          connexion?: string | null;
          discipline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          hex_code?: string;
          designation?: string;
          temps_unitaire_h?: number | null;
          unite_mesure?: string | null;
          dn?: string | null;
          pn?: string | null;
          matiere?: string | null;
          connexion?: string | null;
          discipline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalogue_items_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      supplier_prices: {
        Row: {
          id: string;
          tenant_id: string;
          catalogue_item_id: string;
          supplier_name: string;
          prix_brut: number;
          remise_pct: number;
          prix_net: number;
          validite_fin: string | null;
          delai_jours: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          catalogue_item_id: string;
          supplier_name: string;
          prix_brut: number;
          remise_pct?: number;
          validite_fin?: string | null;
          delai_jours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          catalogue_item_id?: string;
          supplier_name?: string;
          prix_brut?: number;
          remise_pct?: number;
          validite_fin?: string | null;
          delai_jours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_prices_catalogue_item_id_fkey";
            columns: ["catalogue_item_id"];
            referencedRelation: "catalogue_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_prices_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      material_indices: {
        Row: {
          id: string;
          tenant_id: string;
          matiere: string;
          index_date: string;
          coefficient: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          matiere: string;
          index_date: string;
          coefficient: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          matiere?: string;
          index_date?: string;
          coefficient?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_indices_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      pricing_params: {
        Row: {
          id: string;
          tenant_id: string;
          lot: string | null;
          discipline: string | null;
          taux_horaire_eur: number;
          marge_pct: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          lot?: string | null;
          discipline?: string | null;
          taux_horaire_eur: number;
          marge_pct: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          lot?: string | null;
          discipline?: string | null;
          taux_horaire_eur?: number;
          marge_pct?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_params_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      dpgf_imports: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          status: Database["public"]["Enums"]["import_status"];
          row_count: number | null;
          parsed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          status?: Database["public"]["Enums"]["import_status"];
          row_count?: number | null;
          parsed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          filename?: string;
          storage_path?: string;
          status?: Database["public"]["Enums"]["import_status"];
          row_count?: number | null;
          parsed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dpgf_imports_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dpgf_imports_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      dpgf_rows_raw: {
        Row: {
          id: string;
          tenant_id: string;
          import_id: string;
          row_index: number;
          raw_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          import_id: string;
          row_index: number;
          raw_data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          import_id?: string;
          row_index?: number;
          raw_data?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dpgf_rows_raw_import_id_fkey";
            columns: ["import_id"];
            referencedRelation: "dpgf_imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dpgf_rows_raw_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      dpgf_rows_mapped: {
        Row: {
          id: string;
          tenant_id: string;
          import_id: string;
          row_index: number;
          catalogue_item_id: string | null;
          hex_code: string | null;
          quantity: number | null;
          unit: string | null;
          mapping_source: string | null;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          import_id: string;
          row_index: number;
          catalogue_item_id?: string | null;
          hex_code?: string | null;
          quantity?: number | null;
          unit?: string | null;
          mapping_source?: string | null;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          import_id?: string;
          row_index?: number;
          catalogue_item_id?: string | null;
          hex_code?: string | null;
          quantity?: number | null;
          unit?: string | null;
          mapping_source?: string | null;
          confidence?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dpgf_rows_mapped_catalogue_item_id_fkey";
            columns: ["catalogue_item_id"];
            referencedRelation: "catalogue_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dpgf_rows_mapped_import_id_fkey";
            columns: ["import_id"];
            referencedRelation: "dpgf_imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dpgf_rows_mapped_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      mapping_memory: {
        Row: {
          id: string;
          tenant_id: string;
          normalized_label: string;
          hex_code: string;
          confidence: number;
          usage_count: number;
          last_used_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          normalized_label: string;
          hex_code: string;
          confidence?: number;
          usage_count?: number;
          last_used_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          normalized_label?: string;
          hex_code?: string;
          confidence?: number;
          usage_count?: number;
          last_used_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mapping_memory_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      quotes: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          reference: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          valid_until: string | null;
          created_by: string;
          meta: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          reference?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          valid_until?: string | null;
          created_by: string;
          meta?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          reference?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          valid_until?: string | null;
          created_by?: string;
          meta?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      quote_lines: {
        Row: {
          id: string;
          tenant_id: string;
          quote_id: string;
          catalogue_item_id: string | null;
          designation: string;
          quantity: number;
          unite: string | null;
          cout_achat_u: number | null;
          mo_u: number | null;
          pv_u: number | null;
          flags: Json | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          quote_id: string;
          catalogue_item_id?: string | null;
          designation: string;
          quantity: number;
          unite?: string | null;
          cout_achat_u?: number | null;
          mo_u?: number | null;
          pv_u?: number | null;
          flags?: Json | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          quote_id?: string;
          catalogue_item_id?: string | null;
          designation?: string;
          quantity?: number;
          unite?: string | null;
          cout_achat_u?: number | null;
          mo_u?: number | null;
          pv_u?: number | null;
          flags?: Json | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_lines_catalogue_item_id_fkey";
            columns: ["catalogue_item_id"];
            referencedRelation: "catalogue_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey";
            columns: ["quote_id"];
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_lines_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          action: string;
          table_name: string;
          record_id: string;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string | null;
          action?: string;
          table_name?: string;
          record_id?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      is_admin_of: {
        Args: { tenant: string };
        Returns: boolean;
      };
      is_member_of: {
        Args: { tenant: string };
        Returns: boolean;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      log_row_audit: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      role_type: 'admin' | 'engineer' | 'viewer';
      import_status: 'pending' | 'processing' | 'parsed' | 'failed';
      quote_status: 'draft' | 'sent' | 'won' | 'lost';
    };
  };
}
