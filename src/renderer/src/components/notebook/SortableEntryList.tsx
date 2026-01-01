/**
 * SortableEntryList
 *
 * Drag-and-drop sortable list of notebook entries.
 *
 * @module components/notebook/SortableEntryList
 */

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NotebookEntryCard } from './NotebookEntryCard'
import type { NotebookEntry, UpdateEntryInput } from '../../types/notebook'

interface SortableEntryListProps {
  entries: NotebookEntry[]
  notebookId: string
  onDeleteEntry: (id: string) => Promise<boolean>
  onUpdateEntry: (id: string, input: UpdateEntryInput) => Promise<boolean>
  onReorder: (orderedIds: string[]) => Promise<boolean>
}

function SortableEntry({
  entry,
  onDelete,
  onUpdate
}: {
  entry: NotebookEntry
  onDelete: () => Promise<boolean>
  onUpdate: (input: UpdateEntryInput) => Promise<boolean>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <NotebookEntryCard
        entry={entry}
        onDelete={onDelete}
        onUpdate={onUpdate}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  )
}

export function SortableEntryList({
  entries,
  onDeleteEntry,
  onUpdateEntry,
  onReorder
}: SortableEntryListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localEntries, setLocalEntries] = useState(entries)

  // Update local entries when prop changes
  useEffect(() => {
    setLocalEntries(entries)
  }, [entries])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px drag before activating
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = localEntries.findIndex(e => e.id === active.id)
      const newIndex = localEntries.findIndex(e => e.id === over.id)

      const newOrder = arrayMove(localEntries, oldIndex, newIndex)
      setLocalEntries(newOrder)

      // Persist the new order
      const orderedIds = newOrder.map(e => e.id)
      await onReorder(orderedIds)
    }
  }

  const activeEntry = activeId ? localEntries.find(e => e.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {localEntries.map((entry) => (
            <SortableEntry
              key={entry.id}
              entry={entry}
              onDelete={() => onDeleteEntry(entry.id)}
              onUpdate={(input) => onUpdateEntry(entry.id, input)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeEntry ? (
          <div className="opacity-80">
            <NotebookEntryCard
              entry={activeEntry}
              onDelete={async () => false}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default SortableEntryList
