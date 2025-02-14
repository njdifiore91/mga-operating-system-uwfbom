import React, { useState, useCallback, useRef } from 'react';
import { TextField } from '@mui/material'; // v5.14.x
import { Search } from '@mui/icons-material'; // v5.14.x
import { debounce } from 'lodash'; // v4.17.x
import { validateRequired } from '../../utils/validation.utils';

/**
 * Props interface for the SearchBar component
 */
interface SearchBarProps {
  placeholder: string;
  onSearch: (value: string) => void;
  initialValue?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  onClear?: () => void;
  debounceMs?: number;
}

/**
 * A reusable search bar component with real-time search functionality,
 * debouncing, keyboard navigation, and WCAG 2.1 Level AA compliance.
 * 
 * @component
 * @version 1.0.0
 */
const SearchBar: React.FC<SearchBarProps> = ({
  placeholder,
  onSearch,
  initialValue = '',
  disabled = false,
  className = '',
  ariaLabel = 'Search input',
  onClear,
  debounceMs = 300
}) => {
  // State management
  const [searchValue, setSearchValue] = useState<string>(initialValue);
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      const validationResult = validateRequired(value, 'Search', { required: false });
      if (validationResult.isValid) {
        onSearch(value);
        // Announce to screen readers
        const announcement = value 
          ? `Searching for ${value}`
          : 'Search cleared';
        announceToScreenReader(announcement);
      }
    }, debounceMs),
    [onSearch, debounceMs]
  );

  /**
   * Handles changes to the search input with validation and debouncing
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setSearchValue(value);
    
    const validationResult = validateRequired(value, 'Search', { required: false });
    if (!validationResult.isValid) {
      setError(validationResult.errors.Search?.[0] || '');
      return;
    }
    
    setError('');
    debouncedSearch(value);
  };

  /**
   * Handles keyboard events for enhanced navigation and accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        debouncedSearch.flush();
        break;
      case 'Escape':
        event.preventDefault();
        clearSearch();
        break;
      default:
        break;
    }
  };

  /**
   * Clears the search input and announces the action to screen readers
   */
  const clearSearch = (): void => {
    setSearchValue('');
    setError('');
    debouncedSearch.cancel();
    onClear?.();
    announceToScreenReader('Search cleared');
    inputRef.current?.focus();
  };

  /**
   * Announces messages to screen readers using ARIA live region
   */
  const announceToScreenReader = (message: string): void => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('class', 'sr-only');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  return (
    <div 
      className={`search-bar-container ${className}`}
      role="search"
    >
      <TextField
        ref={inputRef}
        fullWidth
        value={searchValue}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        error={!!error}
        helperText={error}
        InputProps={{
          startAdornment: <Search color="action" />,
          'aria-label': ariaLabel,
          'aria-invalid': !!error,
          'aria-describedby': error ? 'search-error-text' : undefined
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '&:hover': {
              '& > fieldset': {
                borderColor: 'primary.main',
              },
            },
          },
        }}
      />
      {/* Hidden element for screen reader announcements */}
      <div 
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        id="search-error-text"
      >
        {error}
      </div>
    </div>
  );
};

export default SearchBar;