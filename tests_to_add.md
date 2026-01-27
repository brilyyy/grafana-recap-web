# Test Cases yang Perlu Ditambahkan

## Unit Tests

### 1. AddAppCard Component

```typescript
// src/components/__tests__/AddAppCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddAppCard from '../AddAppCard'

describe('AddAppCard', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should render form dengan input app name', () => {
    render(<AddAppCard />)
    expect(screen.getByLabelText(/application name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add app/i })).toBeInTheDocument()
  })

  test('should validate empty app name', async () => {
    render(<AddAppCard />)
    const submitButton = screen.getByRole('button', { name: /add app/i })
    fireEvent.click(submitButton)
    
    // Form validation should prevent submit
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('should submit valid app name', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true, message: 'Application added successfully' }),
    })

    render(<AddAppCard />)
    const input = screen.getByLabelText(/application name/i)
    const submitButton = screen.getByRole('button', { name: /add app/i })

    fireEvent.change(input, { target: { value: 'Test App' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: 'Test App' }),
      })
    })

    expect(screen.getByText(/application.*added successfully/i)).toBeInTheDocument()
  })

  test('should handle duplicate app name error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: false, message: 'Application name already exists' }),
    })

    render(<AddAppCard />)
    const input = screen.getByLabelText(/application name/i)
    const submitButton = screen.getByRole('button', { name: /add app/i })

    fireEvent.change(input, { target: { value: 'Duplicate App' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    })
  })

  test('should dispatch appAdded event setelah success', async () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent')
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    render(<AddAppCard />)
    const input = screen.getByLabelText(/application name/i)
    const submitButton = screen.getByRole('button', { name: /add app/i })

    fireEvent.change(input, { target: { value: 'Test App' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'appAdded'
      }))
    })
  })

  test('should auto-hide success message setelah 5 detik', async () => {
    jest.useFakeTimers()
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    render(<AddAppCard />)
    const input = screen.getByLabelText(/application name/i)
    const submitButton = screen.getByRole('button', { name: /add app/i })

    fireEvent.change(input, { target: { value: 'Test App' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument()
    })

    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(screen.queryByText(/success/i)).not.toBeInTheDocument()
    })

    jest.useRealTimers()
  })
})
```

### 2. DictionaryUploadCard - File Validation

```typescript
// src/components/__tests__/DictionaryUploadCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DictionaryUploadCard from '../DictionaryUploadCard'

describe('DictionaryUploadCard - File Validation', () => {
  test('should reject invalid file extension', async () => {
    render(<DictionaryUploadCard />)
    
    const fileInput = screen.getByLabelText(/drag.*drop/i).closest('div')?.querySelector('input[type="file"]')
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })

    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    })

    fireEvent.change(fileInput!)

    await waitFor(() => {
      expect(screen.getByText(/please upload only excel/i)).toBeInTheDocument()
    })
  })

  test('should accept valid Excel file', async () => {
    render(<DictionaryUploadCard />)
    
    const fileInput = screen.getByLabelText(/drag.*drop/i).closest('div')?.querySelector('input[type="file"]')
    const validFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    })

    // Mock XLSX library
    ;(window as any).XLSX = {
      read: jest.fn(() => ({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {
            '!ref': 'A1:D2',
            A1: { v: 'Jenis Transaksi' },
            B1: { v: 'RC' },
            C1: { v: 'S/N' },
            D1: { v: 'RC Description' },
            A2: { v: 'Transfer' },
            B2: { v: '00' },
            C2: { v: 'Sukses' },
            D2: { v: 'Success' },
          },
        },
      })),
      utils: {
        decode_range: jest.fn(() => ({ s: { c: 0, r: 0 }, e: { c: 3, r: 1 } })),
        encode_cell: jest.fn(({ r, c }) => String.fromCharCode(65 + c) + (r + 1)),
      },
    }

    fireEvent.change(fileInput!)

    await waitFor(() => {
      expect(screen.getByText(/file valid/i)).toBeInTheDocument()
    })
  })

  test('should validate required columns', async () => {
    render(<DictionaryUploadCard />)
    
    const fileInput = screen.getByLabelText(/drag.*drop/i).closest('div')?.querySelector('input[type="file"]')
    const invalidFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    })

    ;(window as any).XLSX = {
      read: jest.fn(() => ({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {
            '!ref': 'A1:B2',
            A1: { v: 'Wrong Column' },
            B1: { v: 'Another Column' },
          },
        },
      })),
      utils: {
        decode_range: jest.fn(() => ({ s: { c: 0, r: 0 }, e: { c: 1, r: 1 } })),
        encode_cell: jest.fn(({ r, c }) => String.fromCharCode(65 + c) + (r + 1)),
      },
    }

    fireEvent.change(fileInput!)

    await waitFor(() => {
      expect(screen.getByText(/invalid file format/i)).toBeInTheDocument()
    })
  })
})
```

### 3. CSV Parser Utility

```typescript
// src/utils/__tests__/csvParser.test.ts
import { parseCSV } from '../csvParser'

describe('CSV Parser', () => {
  test('should parse simple CSV', () => {
    const csv = 'col1,col2,col3\nval1,val2,val3'
    const result = parseCSV(csv)
    expect(result).toEqual([['col1', 'col2', 'col3'], ['val1', 'val2', 'val3']])
  })

  test('should handle quoted fields', () => {
    const csv = 'col1,"col2,with,commas",col3\nval1,"val2,with,commas",val3'
    const result = parseCSV(csv)
    expect(result).toEqual([
      ['col1', 'col2,with,commas', 'col3'],
      ['val1', 'val2,with,commas', 'val3']
    ])
  })

  test('should handle escaped quotes', () => {
    const csv = 'col1,"col2""with""quotes",col3'
    const result = parseCSV(csv)
    expect(result).toEqual([['col1', 'col2"with"quotes', 'col3']])
  })

  test('should handle newlines dalam quoted fields', () => {
    const csv = 'col1,"col2\nwith\nnewlines",col3'
    const result = parseCSV(csv)
    expect(result).toEqual([['col1', 'col2\nwith\nnewlines', 'col3']])
  })

  test('should handle empty rows', () => {
    const csv = 'col1,col2\nval1,val2\n\nval3,val4'
    const result = parseCSV(csv)
    expect(result.length).toBe(4) // Includes empty row
  })
})
```

## Integration Tests

### 1. Upload Dictionary API

```typescript
// src/app/api/upload-dictionary/__tests__/route.test.ts
import { POST } from '../route'
import { NextRequest } from 'next/server'
import pool from '@/lib/db'

jest.mock('@/lib/db')
jest.mock('xlsx')

describe('POST /api/upload-dictionary', () => {
  let mockConnection: any

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      release: jest.fn(),
    }
    ;(pool.getConnection as jest.Mock).mockResolvedValue(mockConnection)
  })

  test('should reject jika file tidak diupload', async () => {
    const formData = new FormData()
    formData.append('selectedApplicationId', '1')

    const request = new NextRequest('http://localhost/api/upload-dictionary', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.message).toContain('No file uploaded')
  })

  test('should reject jika application ID tidak valid', async () => {
    const formData = new FormData()
    formData.append('dictionaryFile', new File(['test'], 'test.xlsx'))
    formData.append('selectedApplicationId', 'invalid')

    const request = new NextRequest('http://localhost/api/upload-dictionary', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.message).toContain('Valid application selection')
  })

  test('should reject jika ada skipped rows', async () => {
    // Mock file dengan invalid S/N value
    const formData = new FormData()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    formData.append('dictionaryFile', file)
    formData.append('selectedApplicationId', '1')

    // Mock CSV content dengan invalid S/N
    jest.spyOn(file, 'text').mockResolvedValue(
      'Jenis Transaksi,RC,S/N\nTransfer,00,Invalid'
    )

    const request = new NextRequest('http://localhost/api/upload-dictionary', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.data.skippedRows).toBeDefined()
    expect(data.data.skippedRows.length).toBeGreaterThan(0)
  })

  test('should insert dictionary entries jika valid', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    formData.append('dictionaryFile', file)
    formData.append('selectedApplicationId', '1')

    jest.spyOn(file, 'text').mockResolvedValue(
      'Jenis Transaksi,RC,S/N\nTransfer,00,Sukses'
    )

    mockConnection.execute
      .mockResolvedValueOnce([[{ app_name: 'Test App' }]]) // Verify app
      .mockResolvedValueOnce([{ insertId: 1 }]) // Insert dictionary

    const request = new NextRequest('http://localhost/api/upload-dictionary', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO response_code_dictionary'),
      expect.arrayContaining([1, 'Transfer', '00', 'Sukses'])
    )
  })
})
```

### 2. Upload Success Rate API - Error Type Assignment

```typescript
// src/app/api/upload-success-rate/__tests__/errorTypeAssignment.test.ts
import { POST } from '../route'
import { NextRequest } from 'next/server'
import pool from '@/lib/db'

jest.mock('@/lib/db')

describe('Error Type Assignment Logic', () => {
  let mockConnection: any

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      release: jest.fn(),
    }
    ;(pool.getConnection as jest.Mock).mockResolvedValue(mockConnection)
  })

  test('should assign error_type dari dictionary jika RC ada', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    formData.append('successRateFile', file)
    formData.append('selectedApplicationId', '1')

    jest.spyOn(file, 'text').mockResolvedValue(
      'Tanggal Transaksi,Jenis Transaksi,RC,total transaksi,Total Nominal,Total Biaya Admin,Status Transaksi\n01/01/2024,Transfer,00,100,1000000,5000,failed'
    )

    mockConnection.execute
      .mockResolvedValueOnce([[{ app_name: 'Test App' }]]) // Verify app
      .mockResolvedValueOnce([[{ error_type: 'N' }]]) // Dictionary lookup
      .mockResolvedValueOnce([{ insertId: 1 }]) // Insert success rate

    const request = new NextRequest('http://localhost/api/upload-success-rate', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    // Verify error_type di-assign dari dictionary
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app_success_rate'),
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), '00', expect.anything(), expect.anything(), expect.anything(), expect.anything(), 'failed', 'N'])
    )
  })

  test('should assign error_type = Sukses jika RC NULL dan status sukses', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    formData.append('successRateFile', file)
    formData.append('selectedApplicationId', '1')

    jest.spyOn(file, 'text').mockResolvedValue(
      'Tanggal Transaksi,Jenis Transaksi,RC,total transaksi,Total Nominal,Total Biaya Admin,Status Transaksi\n01/01/2024,Transfer,,100,1000000,5000,sukses'
    )

    mockConnection.execute
      .mockResolvedValueOnce([[{ app_name: 'Test App' }]])
      .mockResolvedValueOnce([{ insertId: 1 }])

    const request = new NextRequest('http://localhost/api/upload-success-rate', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    // Verify RC di-assign ke '00' dan error_type = 'Sukses'
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app_success_rate'),
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), '00', 'Success', expect.anything(), expect.anything(), expect.anything(), 'sukses', 'Sukses'])
    )
  })

  test('should insert ke unmapped_rc jika RC tidak ada di dictionary', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    formData.append('successRateFile', file)
    formData.append('selectedApplicationId', '1')

    jest.spyOn(file, 'text').mockResolvedValue(
      'Tanggal Transaksi,Jenis Transaksi,RC,total transaksi,Total Nominal,Total Biaya Admin,Status Transaksi\n01/01/2024,Transfer,99,100,1000000,5000,failed'
    )

    mockConnection.execute
      .mockResolvedValueOnce([[{ app_name: 'Test App' }]])
      .mockResolvedValueOnce([]) // Dictionary lookup - not found
      .mockResolvedValueOnce([]) // RC only lookup - not found
      .mockResolvedValueOnce([{ insertId: 1 }]) // Insert unmapped_rc
      .mockResolvedValueOnce([{ insertId: 2 }]) // Insert success rate

    const request = new NextRequest('http://localhost/api/upload-success-rate', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    // Verify insert ke unmapped_rc
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT IGNORE INTO unmapped_rc'),
      expect.arrayContaining([1, 'Transfer', '99', expect.anything(), 'failed'])
    )
  })
})
```

## E2E Tests (Cypress)

### 1. Complete Upload Dictionary Flow

```typescript
// cypress/e2e/upload-dictionary.cy.ts
describe('Upload Dictionary Flow', () => {
  beforeEach(() => {
    cy.visit('/')
    // Mock API responses
    cy.intercept('GET', '/api/applications', { fixture: 'applications.json' }).as('getApplications')
    cy.intercept('POST', '/api/upload-dictionary', { fixture: 'upload-dictionary-success.json' }).as('uploadDictionary')
  })

  it('should upload dictionary file successfully', () => {
    cy.wait('@getApplications')

    // Select application
    cy.get('[data-testid="dictionary-upload-card"]').within(() => {
      cy.get('select').select('Bale')
    })

    // Upload file
    cy.get('[data-testid="dictionary-upload-card"]').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/dictionary-valid.xlsx', { force: true })
    })

    // Wait for file validation
    cy.contains('File valid! Columns verified.').should('be.visible')

    // Click upload button
    cy.get('[data-testid="dictionary-upload-card"]').within(() => {
      cy.get('button').contains('Upload').click()
    })

    cy.wait('@uploadDictionary')

    // Verify success message
    cy.contains(/dictionary uploaded successfully/i).should('be.visible')

    // Verify form reset
    cy.get('[data-testid="dictionary-upload-card"]').within(() => {
      cy.get('select').should('have.value', '')
      cy.get('input[type="file"]').should('have.value', '')
    })
  })

  it('should show error popup jika ada skipped rows', () => {
    cy.intercept('POST', '/api/upload-dictionary', {
      statusCode: 400,
      body: {
        success: false,
        message: 'Upload gagal: 2 row(s) memiliki error',
        data: {
          skippedRows: [
            { rowNumber: 2, reason: 'Kolom S/N tidak valid: "X"' },
            { rowNumber: 3, reason: 'Kolom S/N tidak valid: ""' }
          ],
          totalSkipped: 2,
          totalProcessed: 0
        }
      }
    }).as('uploadDictionaryError')

    cy.get('[data-testid="dictionary-upload-card"]').within(() => {
      cy.get('select').select('Bale')
      cy.get('input[type="file"]').selectFile('cypress/fixtures/dictionary-invalid.xlsx', { force: true })
      cy.get('button').contains('Upload').click()
    })

    cy.wait('@uploadDictionaryError')

    // Verify error popup muncul
    cy.get('[data-testid="error-popup"]').should('be.visible')
    cy.contains('Upload Gagal - Row dengan Error Ditemukan').should('be.visible')
    cy.contains('Row 2').should('be.visible')
    cy.contains('Row 3').should('be.visible')
  })
})
```

### 2. Unmapped RC Submit Flow

```typescript
// cypress/e2e/unmapped-rc-submit.cy.ts
describe('Unmapped RC Submit Flow', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.intercept('GET', '/api/applications', { fixture: 'applications.json' }).as('getApplications')
    cy.intercept('GET', '/api/unmapped-rc', { fixture: 'unmapped-rc.json' }).as('getUnmappedRc')
    cy.intercept('POST', '/api/unmapped-rc/submit', { fixture: 'submit-unmapped-rc-success.json' }).as('submitUnmappedRc')
  })

  it('should submit unmapped RC mapping', () => {
    cy.wait('@getApplications')
    cy.wait('@getUnmappedRc')

    // Select error type untuk RC pertama
    cy.get('[data-testid="unmapped-rc-card"]').within(() => {
      cy.get('input[type="radio"][value="N"]').first().check()
    })

    // Click submit button untuk RC pertama
    cy.get('[data-testid="unmapped-rc-card"]').within(() => {
      cy.get('button').contains('Submit').first().click()
    })

    cy.wait('@submitUnmappedRc')

    // Verify success message
    cy.contains(/rc mapping added successfully/i).should('be.visible')

    // Verify RC dihapus dari list
    cy.get('[data-testid="unmapped-rc-card"]').within(() => {
      cy.get('li').should('have.length', 1) // Sisa 1 RC
    })
  })

  it('should submit batch mappings', () => {
    cy.wait('@getApplications')
    cy.wait('@getUnmappedRc')

    cy.intercept('POST', '/api/unmapped-rc/submit-batch', { fixture: 'submit-batch-success.json' }).as('submitBatch')

    // Select multiple RCs
    cy.get('[data-testid="unmapped-rc-card"]').within(() => {
      cy.get('input[type="checkbox"]').first().check()
      cy.get('input[type="checkbox"]').eq(1).check()
      
      // Select error type untuk masing-masing
      cy.get('input[type="radio"][value="S"]').first().check()
      cy.get('input[type="radio"][value="N"]').eq(1).check()
    })

    // Click submit all button
    cy.get('[data-testid="unmapped-rc-card"]').within(() => {
      cy.get('button').contains('Submit All').click()
    })

    cy.wait('@submitBatch')

    // Verify success
    cy.contains(/successfully mapped.*rc/i).should('be.visible')
  })
})
```

## Test Coverage Goals

### Priority 1 (Critical Business Logic)
- [ ] Upload Dictionary - File validation & parsing
- [ ] Upload Success Rate - Error type assignment logic
- [ ] Unmapped RC Submit - Transaction & update logic
- [ ] CSV Parser - Edge cases (quoted fields, newlines, etc.)

### Priority 2 (User Flows)
- [ ] Add Application - Form validation & submission
- [ ] Dictionary View - Filter & pagination
- [ ] No RC Transaction - Assign RC flow

### Priority 3 (Edge Cases)
- [ ] Error handling untuk semua API endpoints
- [ ] Custom Events communication
- [ ] File upload error scenarios

## Test Setup

### Dependencies Needed
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@types/jest": "^29.5.0",
    "cypress": "^13.0.0"
  }
}
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
}
```
