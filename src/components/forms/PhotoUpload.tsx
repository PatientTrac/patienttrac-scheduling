import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface PhotoUploadProps {
  currentUrl?:   string | null
  patientName?:  string
  onUpload:      (url: string, path: string) => void
  onRemove?:     () => void
  bucket?:       string
  folder?:       string
  size?:         'sm' | 'md' | 'lg'
}

export function PhotoUpload({
  currentUrl,
  patientName = '',
  onUpload,
  onRemove,
  bucket = 'patient-photos',
  folder = 'patients',
  size = 'md',
}: PhotoUploadProps) {
  const [preview,    setPreview]    = useState<string | null>(currentUrl ?? null)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [dragOver,   setDragOver]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const dimensions = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  }[size]

  const initials = patientName
    .split(' ')
    .map(n => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB')
      return
    }

    setError(null)
    setUploading(true)

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

      onUpload(publicUrl, path)
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed — photo saved locally only')
      // Still show preview even if upload fails
    } finally {
      setUploading(false)
    }
  }, [bucket, folder, onUpload])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleRemove() {
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Photo circle */}
      <div
        className={cn(
          'relative rounded-sm border-2 overflow-hidden cursor-pointer transition-all duration-200',
          dimensions,
          dragOver
            ? 'border-gold-500 bg-gold-500/10'
            : 'border-gold-500/20 bg-navy-700 hover:border-gold-500/40',
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt={patientName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {initials ? (
              <span className="font-display font-bold text-2xl text-gold-400">{initials}</span>
            ) : (
              <User size={28} className="text-slate-600" />
            )}
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-navy-900/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
          ) : (
            <Camera size={18} className="text-gold-400" />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-ghost text-xs py-1 px-2"
        >
          <Upload size={11} />
          {preview ? 'Change' : 'Upload photo'}
        </button>
        {preview && onRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-300"
          >
            <X size={11} />
            Remove
          </button>
        )}
      </div>

      {error && (
        <div className="text-[10px] text-amber-400 font-mono text-center max-w-32">{error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) processFile(file)
        }}
      />
    </div>
  )
}
