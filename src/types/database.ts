export type TransactionType = "income" | "expense";
export type BudgetRecurrence =
  | "monthly"
  | "yearly"
  | "quarterly"
  | "weekly"
  | "daily"
  | "one_time";
export type AuthLoginType = "email" | "google" | "apple" | "github" | "microsoft" | "other";
export type CategoryKind = "expense" | "income" | "neutral";
export type PaymentMethod = "cash" | "bank" | "cards" | "stocks" | "wallet";
export type TransactionLineStatus = "pending" | "cleared" | "failed";
export type OccurrenceScheduleStatus = "PENDING" | "DUE" | "OVERDUE" | "DONE";

export interface Database {
  public: {
    Tables: {
      user: {
        Row: {
          id: string;
          email: string | null;
          email_verified: boolean;
          phone: string | null;
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
          project_id: string;
          name: string;
          icon: string;
          kind: CategoryKind;
          created_by_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          icon: string;
          kind: CategoryKind;
          created_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          icon?: string;
          kind?: CategoryKind;
          created_by_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget: {
        Row: {
          id: string;
          project_id: string;
          created_by_user_id: string;
          category_id: string;
          title: string;
          default_planned_amount: number;
          start_date: string;
          recurrence_end_date: string | null;
          due_day_of_occurence: number;
          recurrence: BudgetRecurrence;
          payment_method: PaymentMethod;
          bank_account_id: string | null;
          card_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          created_by_user_id: string;
          category_id: string;
          title: string;
          default_planned_amount: number;
          start_date: string;
          recurrence_end_date?: string | null;
          due_day_of_occurence: number;
          recurrence?: BudgetRecurrence;
          payment_method?: PaymentMethod;
          bank_account_id?: string | null;
          card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          created_by_user_id?: string;
          category_id?: string;
          title?: string;
          default_planned_amount?: number;
          start_date?: string;
          recurrence_end_date?: string | null;
          due_day_of_occurence?: number;
          recurrence?: BudgetRecurrence;
          payment_method?: PaymentMethod;
          bank_account_id?: string | null;
          card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction: {
        Row: {
          id: string;
          project_id: string;
          created_by_user_id: string;
          user_id: string;
          type: TransactionType;
          name: string;
          amount: number;
          line_status: TransactionLineStatus;
          payment_method: PaymentMethod;
          occurred_at: string;
          category_id: string | null;
          note: string | null;
          budget_id: string | null;
          period_start: string | null;
          due_date: string | null;
          bank_account_id: string | null;
          card_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          created_by_user_id: string;
          user_id: string;
          type: TransactionType;
          name: string;
          amount: number;
          line_status?: TransactionLineStatus;
          payment_method?: PaymentMethod;
          occurred_at: string;
          category_id?: string | null;
          note?: string | null;
          budget_id?: string | null;
          period_start?: string | null;
          due_date?: string | null;
          bank_account_id?: string | null;
          card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          created_by_user_id?: string;
          user_id?: string;
          type?: TransactionType;
          name?: string;
          amount?: number;
          line_status?: TransactionLineStatus;
          payment_method?: PaymentMethod;
          occurred_at?: string;
          category_id?: string | null;
          note?: string | null;
          budget_id?: string | null;
          period_start?: string | null;
          due_date?: string | null;
          bank_account_id?: string | null;
          card_id?: string | null;
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
      category_kind: CategoryKind;
      payment_method: PaymentMethod;
      transaction_line_status: TransactionLineStatus;
      occurrence_schedule_status: OccurrenceScheduleStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type TransactionRow = Database["public"]["Tables"]["transaction"]["Row"];
