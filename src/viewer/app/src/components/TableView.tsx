import { useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from '@tanstack/react-table'
import { Post } from '../types'

interface TableViewProps {
  posts: Post[]
  onPostUpdate: (post: Partial<Post>) => void
  onPostDelete: (postId: number) => void
}

const columnHelper = createColumnHelper<Post>()

export function TableView({ posts, onPostUpdate, onPostDelete }: TableViewProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Post>>({})
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const startEdit = (post: Post) => {
    setEditingId(post.id)
    setEditForm({
      search_keywords: post.search_keywords,
      description: post.description,
      applied: post.applied
    })
    setErrorMessage(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setErrorMessage(null)
  }

  const handleSaveEdit = async (postId: number) => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      // Get the original post to merge changes
      const originalPost = posts.find(p => p.id === postId)
      if (!originalPost) {
        throw new Error('Post not found')
      }

      const updatedPost: Post = {
        ...originalPost,
        search_keywords: editForm.search_keywords ?? originalPost.search_keywords,
        description: editForm.description ?? originalPost.description,
        applied: editForm.applied ?? originalPost.applied
      }

      const response = await fetch('/api/posts/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([updatedPost])
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update post')
      }
      
      cancelEdit()
      onPostUpdate(updatedPost)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (post: Post) => {
    if (!confirm(`Are you sure you want to delete this post?\n\nKeywords: ${post.search_keywords}`)) {
      return
    }

    setLoading(true)
    setErrorMessage(null)
    
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete post')
      }
      
      onPostDelete(post.id)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleApplied = async (post: Post) => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      const newAppliedStatus = !post.applied
      const response = await fetch(`/api/posts/${post.id}/applied`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied: newAppliedStatus })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update applied status')
      }
      
      onPostUpdate({ id: post.id, applied: newAppliedStatus ? 1 : 0 })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: info => <span className="font-medium text-ink">{info.getValue()}</span>,
      size: 60
    }),
    columnHelper.accessor('profile_image', {
      header: 'Avatar',
      cell: info => (
        <div className="flex justify-center">
          {info.getValue() ? (
            <img 
              src={info.getValue()} 
              alt="Profile" 
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-faint">-</span>
          )}
        </div>
      ),
      size: 80
    }),
    columnHelper.accessor('author_name', {
      header: 'Author',
      cell: info => (
        <span className="font-medium text-muted">
          {info.getValue() || '-'}
        </span>
      ),
      size: 150
    }),
    columnHelper.accessor('author_occupation', {
      header: 'Occupation',
      cell: info => (
        <span className="text-muted">
          {info.getValue() || '-'}
        </span>
      ),
      size: 200
    }),
    columnHelper.accessor('search_keywords', {
      header: 'Keywords',
      cell: info =>
        editingId === info.row.original.id ? (
          <input
            type="text"
            value={editForm.search_keywords ?? ''}
            onChange={e => setEditForm({ ...editForm, search_keywords: e.target.value })}
            className="bg-surface border border-line text-ink text-sm rounded-lg focus:ring-brand/30 focus:border-brand block w-full p-2.5"
          />
        ) : (
          <span className="font-semibold text-ink">{info.getValue()}</span>
        ),
      size: 200
    }),
    columnHelper.accessor('verdict', {
      header: 'Verdict',
      cell: info => {
        const verdict = info.getValue()
        const tone: Record<string, string> = {
          yes: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
          maybe: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
          no: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
        }
        const label: Record<string, string> = { yes: 'Ok', maybe: 'Maybe', no: 'Not interested' }
        return verdict ? (
          <span className={`chip ${tone[verdict]}`}>{label[verdict]}</span>
        ) : (
          <span className="text-faint">not rated</span>
        )
      },
      size: 130
    }),
    columnHelper.accessor('country', {
      header: 'Country',
      cell: info => (
        <span className="text-muted">{info.getValue() || '—'}</span>
      ),
      size: 160
    }),
    columnHelper.accessor('salary', {
      header: 'Salary',
      cell: info => {
        const salary = info.getValue()
        return salary ? (
          <span className="font-medium text-emerald-700 whitespace-normal">{salary}</span>
        ) : (
          <span className="text-faint">—</span>
        )
      },
      size: 150
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: info =>
        editingId === info.row.original.id ? (
          <textarea
            value={editForm.description ?? ''}
            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
            className="bg-surface border border-line text-ink text-sm rounded-lg focus:ring-brand/30 focus:border-brand block w-full p-2.5"
            rows={3}
          />
        ) : (
          <div className="max-h-24 overflow-y-auto pr-2">
            <p className="whitespace-normal break-words">
              {info.getValue()}
            </p>
          </div>
        ),
      size: 400
    }),
    columnHelper.accessor('post_date', {
      header: 'Post Date',
      cell: info => (
        <span className="text-muted text-sm">
          {info.getValue() || '-'}
        </span>
      ),
      size: 120
    }),
    columnHelper.accessor('search_date', {
      header: 'Scraped',
      cell: info => (
        <span className="text-muted text-xs">
          {new Date(info.getValue()).toLocaleDateString()}
        </span>
      ),
      size: 100
    }),
    columnHelper.accessor('like_count', {
      header: 'Likes',
      cell: info => (
        <div className="text-center">
          <span className="text-muted">
            {info.getValue() ? `👍 ${info.getValue()}` : '-'}
          </span>
        </div>
      ),
      size: 90
    }),
    columnHelper.accessor('comment_count', {
      header: 'Comments',
      cell: info => (
        <div className="text-center">
          <span className="text-muted">
            {info.getValue() ? `💬 ${info.getValue()}` : '-'}
          </span>
        </div>
      ),
      size: 110
    }),
    columnHelper.accessor('applied', {
      header: 'Applied',
      cell: info => (
        <div className="flex justify-center">
          {editingId === info.row.original.id ? (
            <input
              type="checkbox"
              checked={editForm.applied === 1}
              onChange={e => setEditForm({ ...editForm, applied: e.target.checked ? 1 : 0 })}
              className="w-5 h-5 text-brand bg-raised border-line rounded focus:ring-brand/30"
            />
          ) : (
            <button
              onClick={() => handleToggleApplied(info.row.original)}
              className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${
                info.getValue() === 1
                  ? 'text-green-600 hover:bg-green-50'
                  : 'text-faint hover:bg-raised'
              }`}
              disabled={loading}
              title={info.getValue() === 1 ? 'Mark as Not Applied' : 'Mark as Applied'}
            >
              {info.getValue() === 1 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      ),
      size: 80
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-center space-x-2">
          {editingId === row.original.id ? (
            <>
              <button
                onClick={() => handleSaveEdit(row.original.id)}
                className="font-medium text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-md text-xs disabled:opacity-50"
                disabled={loading}
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="font-medium text-muted bg-raised hover:opacity-80 px-3 py-1.5 rounded-md text-xs disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => window.open(row.original.post_link, '_blank')}
                className="font-medium text-brand hover:underline p-1"
                title="Open post"
              >
                🔗
              </button>
              <button
                onClick={() => startEdit(row.original)}
                className="font-medium text-brand hover:underline p-1 disabled:opacity-50"
                disabled={loading}
                title="Edit post"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(row.original)}
                className="font-medium text-red-600 hover:underline p-1 disabled:opacity-50"
                disabled={loading}
                title="Delete post"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      ),
      size: 120
    })
  ]

  const table = useReactTable({
    data: posts,
    columns,
    state: {
      sorting
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  if (posts.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-semibold text-ink">No posts found</p>
        <p className="mt-1 text-sm text-muted">
          Use the search tool to find LinkedIn posts.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {errorMessage && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <div>
            <strong className="font-bold">Error:</strong> {errorMessage}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full table-fixed text-left text-sm text-muted">
          <thead className="sticky top-0 z-10 bg-raised text-xs uppercase tracking-wider text-muted">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    scope="col"
                    className="cursor-pointer select-none px-5 py-3 font-semibold transition-colors hover:text-ink"
                    style={{ 
                      width: header.getSize(),
                      maxWidth: header.getSize() 
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="ml-2">
                        {{
                          asc: '🔼',
                          desc: '🔽'
                        }[header.column.getIsSorted() as string] ?? null}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={`border-b border-line transition-colors last:border-0
                            hover:bg-raised/60 ${
                  editingId === row.original.id ? 'bg-brand-soft' : 'bg-surface'
                }`}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-5 py-4 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


