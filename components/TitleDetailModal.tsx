'use client'

import { FavoriteButton } from '@/components/FavoriteButton'
import { HouseholdUser } from '@/components/HouseholdExcitementRow'
import { TitleDetail, TitleDetailItem } from '@/components/TitleDetail'
import { Modal, ModalBody, ModalHeader } from '@/components/ui/modal'

interface TitleDetailModalProps {
  item: TitleDetailItem
  viewer?: HouseholdUser | null
  onFavoriteChange?: (isFavorite: boolean) => void
  onClose: () => void
}

/** The title overlay opened from a Browse or Watch card: title, heart, detail. */
export function TitleDetailModal({
  item,
  viewer,
  onFavoriteChange,
  onClose,
}: TitleDetailModalProps) {
  return (
    <Modal isOpen onClose={onClose} size='xl' tall aria-label={item.title}>
      <ModalHeader
        title={item.title}
        action={
          <FavoriteButton
            mediaItemId={item.id}
            isFavorite={item.myPreference?.isFavorite === true}
            onChange={onFavoriteChange}
            size={22}
            className='-mt-1.5'
          />
        }
      />
      <ModalBody className='pb-6'>
        <TitleDetail item={item} viewer={viewer} />
      </ModalBody>
    </Modal>
  )
}
