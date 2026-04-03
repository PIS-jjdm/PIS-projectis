import { Avatar } from '@mui/material'
import { avatarUrl } from '../lib/avatar'

export default function UserAvatar({
  userId,
  version = '',
  src = '',
  size,
  sx,
  children,
  ...props
}) {
  return (
    <Avatar
      src={src || avatarUrl(userId, version)}
      sx={[size ? { width: size, height: size } : null, sx]}
      {...props}
    >
      {children}
    </Avatar>
  )
}
