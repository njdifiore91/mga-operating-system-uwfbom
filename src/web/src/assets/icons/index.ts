/**
 * @fileoverview Centralized icon exports for MGA Operating System
 * Implements Material Design 3.0 icon system for consistent visual language
 * @packageDocumentation
 */

// @mui/icons-material v5.14.x - Core navigation icons
import {
  Dashboard as DashboardIcon,
  Policy as PolicyIcon,
  Assignment as UnderwritingIcon,
  Report as ClaimsIcon,
  Description as DocumentsIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

// @mui/icons-material v5.14.x - Common UI action icons
import {
  Notifications as NotificationsIcon,
  AccountCircle,
  Search as SearchIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

// @mui/icons-material v5.14.x - CRUD operation icons
import {
  AddCircleOutline,
  Edit,
  Delete,
  Download,
  Upload,
  Visibility,
  VisibilityOff,
  Save,
  Cancel,
} from '@mui/icons-material';

// @mui/icons-material v5.14.x - Status indicators
import {
  CheckCircle,
  Warning,
  Error,
  Info,
  HelpOutline,
  Block,
  Update,
} from '@mui/icons-material';

/**
 * Primary navigation icons for main application sections
 */
export const navigationIcons = {
  dashboard: DashboardIcon,
  policy: PolicyIcon,
  underwriting: UnderwritingIcon,
  claims: ClaimsIcon,
  documents: DocumentsIcon,
  analytics: AnalyticsIcon,
  settings: SettingsIcon,
} as const;

/**
 * Common UI action icons for user interactions and controls
 */
export const actionIcons = {
  notifications: NotificationsIcon,
  account: AccountCircle,
  search: SearchIcon,
  menu: MenuIcon,
  close: CloseIcon,
  filter: FilterListIcon,
  more: MoreVertIcon,
} as const;

/**
 * Icons for CRUD operations and data manipulation
 */
export const crudIcons = {
  add: AddCircleOutline,
  edit: Edit,
  delete: Delete,
  save: Save,
  cancel: Cancel,
  download: Download,
  upload: Upload,
  show: Visibility,
  hide: VisibilityOff,
} as const;

/**
 * Status and notification indicator icons
 */
export const statusIcons = {
  success: CheckCircle,
  warning: Warning,
  error: Error,
  info: Info,
  help: HelpOutline,
  blocked: Block,
  pending: Update,
} as const;

// Type definitions for icon components
export type NavigationIconType = keyof typeof navigationIcons;
export type ActionIconType = keyof typeof actionIcons;
export type CrudIconType = keyof typeof crudIcons;
export type StatusIconType = keyof typeof statusIcons;

// Re-export all icon groups for convenient access
export {
  navigationIcons,
  actionIcons,
  crudIcons,
  statusIcons,
};