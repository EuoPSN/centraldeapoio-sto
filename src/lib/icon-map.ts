import {
  Home, BookOpen, MessageSquareQuote, DollarSign, Wrench, GraduationCap,
  Bot, Settings, Lightbulb, Users, Database, Sparkles, FileText, Layers,
  HelpCircle, ListChecks, Network, Play, Palette, Menu, Star, Heart,
  Folder, Shield, Tag, Briefcase, Phone, Mail, Globe, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  Home, BookOpen, MessageSquareQuote, DollarSign, Wrench, GraduationCap,
  Bot, Settings, Lightbulb, Users, Database, Sparkles, FileText, Layers,
  HelpCircle, ListChecks, Network, Play, Palette, Menu, Star, Heart,
  Folder, Shield, Tag, Briefcase, Phone, Mail, Globe,
};

export function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Folder;
  return ICONS[name] ?? Folder;
}

export const ICON_NAMES = Object.keys(ICONS);
