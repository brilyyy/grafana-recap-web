import { useEffect, useRef, useState } from 'react'

interface MultiSelectFilterProps {
  label: string
  icon: React.ReactNode
  options: { value: string; label: string }[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
}

export default function MultiSelectFilter({
  label,
  icon,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter options based on search
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase()))

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value))
    } else {
      onChange([...selectedValues, value])
    }
  }

  const removeValue = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedValues.filter((v) => v !== value))
  }

  const getSelectedLabels = () => {
    return selectedValues.map((val) => options.find((opt) => opt.value === val)?.label).filter(Boolean) as string[]
  }

  const selectedLabels = getSelectedLabels()

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full pl-7 pr-8 py-2 text-xs rounded-lg border-2 transition-all shadow-xs hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isOpen ? 'border-blue-500 bg-white' : 'border-gray-200 bg-white/95 backdrop-blur-sm'
        }`}
      >
        <div className="flex items-center gap-2 min-h-[20px]">
          {/* Icon */}
          <div className="absolute left-2 text-gray-400 pointer-events-none">{icon}</div>

          {/* Selected values or placeholder */}
          <div className="flex-1 flex items-center gap-1 flex-wrap">
            {selectedLabels.length > 0 ? (
              <>
                {selectedLabels.slice(0, 2).map((label) => {
                  const value = options.find((opt) => opt.label === label)?.value || ''
                  return (
                    <span
                      key={value}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-medium"
                    >
                      {label.length > 15 ? `${label.substring(0, 15)}...` : label}
                      <button
                        type="button"
                        onClick={(e) => removeValue(value, e)}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )
                })}
                {selectedLabels.length > 2 && (
                  <span className="text-gray-500 text-[10px]">+{selectedLabels.length - 2}</span>
                )}
              </>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>

          {/* Dropdown arrow */}
          <div className="absolute right-2 text-gray-400 pointer-events-none">
            <svg
              className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border-2 border-gray-200 shadow-lg max-h-60 overflow-hidden flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-center text-xs text-gray-500">No options found</div>
            ) : (
              <div className="p-1">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOption(option.value)}
                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                      />
                      <span className="text-xs text-gray-700 flex-1">{option.label}</span>
                      {isSelected && (
                        <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer with select all/none */}
          {filteredOptions.length > 0 && (
            <div className="p-2 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allValues = filteredOptions.map((opt) => opt.value)
                  const newValues = allValues.every((val) => selectedValues.includes(val))
                    ? selectedValues.filter((val) => !allValues.includes(val))
                    : Array.from(new Set([...selectedValues, ...allValues]))
                  onChange(newValues)
                }}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                {filteredOptions.every((opt) => selectedValues.includes(opt.value)) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange([])
                  setSearchQuery('')
                }}
                className="px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
