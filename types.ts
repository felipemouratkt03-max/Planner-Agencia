
export type UserRole = 'admin' | 'client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  start_date: string;
  end_date?: string;
  objectives: string;
  client_emails: string[];
  client_message?: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done' | 'delayed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  assigned_to: string;
  due_date: string;
}

export interface Deliverable {
  id: string;
  project_id: string;
  name: string;
  description: string;
  file_url: string;
  created_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  content: string;
  sender_name: string;
  created_at: string;
}
