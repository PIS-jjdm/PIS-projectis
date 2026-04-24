package org.pis.project.mappers;

import com.google.protobuf.Timestamp;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Component
public class CommonMapper {

    public Timestamp toTimestamp(LocalDateTime dateTime) {
        if (dateTime == null)
            return null;
        return Timestamp.newBuilder()
                .setSeconds(dateTime.toEpochSecond(ZoneOffset.UTC))
                .setNanos(dateTime.getNano())
                .build();
    }

    public LocalDateTime toLocalDateTime(Timestamp timestamp) {
        if (timestamp == null || (timestamp.getSeconds() == 0 && timestamp.getNanos() == 0))
            return null;
        return LocalDateTime.ofEpochSecond(timestamp.getSeconds(), timestamp.getNanos(), ZoneOffset.UTC);
    }
}
