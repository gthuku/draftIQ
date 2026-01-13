'use client';

import * as React from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  disabled = false,
  className = ''
}: DropdownProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-gray-700 font-medium mb-2 text-sm">
          {label}
        </label>
      )}

      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:border-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="overflow-hidden bg-white rounded-lg border border-gray-200 shadow-xl z-50"
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex items-center px-8 py-3 rounded-md text-sm text-gray-900 cursor-pointer select-none hover:bg-gray-100 focus:bg-gray-100 outline-none data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700"
                >
                  <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                    <Check className="w-4 h-4 text-blue-600" />
                  </Select.ItemIndicator>
                  <Select.ItemText>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
