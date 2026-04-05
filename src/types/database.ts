export type TransactionType = "income" | "expense";
export type BudgetRecurrence = "monthly"; // TODO: add other recurrences
export type AuthLoginType = "email" | "google" | "apple" | "github" | "microsoft" | "other";

export interface Database {
  public: {
    Tables: {
      user: {
        Row: {
          id: string;
          email: string | null;
          email_verified: boolean;
          phone: string | null;
          phone_verified: boolean;
          first_name: string | null;
          last_name: string | null;
          username: string | null;
          avatar_url: string | null;
          login_type: AuthLoginType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          email_verified?: boolean;
          phone?: string | null;
          phone_verified?: boolean;
          first_name?: string | null;
          last_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          login_type?: AuthLoginType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          email_verified?: boolean;
          phone?: string | null;
          phone_verified?: boolean;
          first_name?: string | null;
          last_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          login_type?: AuthLoginType;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      category: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          title: string;
          default_planned_amount_paise: number;
          start_date: string;
          recurrence_end_date: string | null;
          due_day_of_month: number;
          recurrence: BudgetRecurrence;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          title: string;
          default_planned_amount_paise: number;
          start_date: string;
          recurrence_end_date?: string | null;
          due_day_of_month: number;
          recurrence?: BudgetRecurrence;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          title?: string;
          default_planned_amount_paise?: number;
          start_date?: string;
          recurrence_end_date?: string | null;
          due_day_of_month?: number;
          recurrence?: BudgetRecurrence;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_occurrence: {
        Row: {
          id: string;
          budget_id: string;
          period_start: string;
          planned_amount_paise: number | null;
          actual_amount_paise: number | null;
          paid_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          budget_id: string;
          period_start: string;
          planned_amount_paise?: number | null;
          actual_amount_paise?: number | null;
          paid_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          budget_id?: string;
          period_start?: string;
          planned_amount_paise?: number | null;
          actual_amount_paise?: number | null;
          paid_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      money_transaction: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount_paise: number;
          occurred_at: string;
          category_id: string | null;
          note: string | null;
          budget_occurrence_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: TransactionType;
          amount_paise: number;
          occurred_at: string;
          category_id?: string | null;
          note?: string | null;
          budget_occurrence_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: TransactionType;
          amount_paise?: number;
          occurred_at?: string;
          category_id?: string | null;
          note?: string | null;
          budget_occurrence_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_type: TransactionType;
      budget_recurrence: BudgetRecurrence;
      auth_login_type: AuthLoginType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type MoneyTransactionRow = Database["public"]["Tables"]["money_transaction"]["Row"];
