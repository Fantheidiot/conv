var parser = module.require("osuparser");
var format = module.require('format');

module.export("osu_to_lua", function(osu_file_contents, audio_id, artist, description, image, difficulty, mapper, selectedOptions) {
    var rtv_lua = "";
    var append_to_output = function(str, newline) {
        if (newline === undefined || newline === true) {
            rtv_lua += (str + "\n");
        } else {
            rtv_lua += (str);
        }
    };

    var beatmap = parser.parseContent(osu_file_contents);

    function track_time_hash(track, time) {
        return track + "_" + time;
    }

    function hitobj_x_to_track_number(hitobj_x) {
        var track_number = 1;
        if (hitobj_x < 100) {
            track_number = 1;
        } else if (hitobj_x < 200) {
            track_number = 2;
        } else if (hitobj_x < 360) {
            track_number = 3;
        } else {
            track_number = 4;
        }
        return track_number;
    }

    function msToTime(s) {
        var ms = s % 1000;
        s = (s - ms) / 1000;
        var secs = s % 60;
        s = (s - secs) / 60;
        var mins = s % 60;
        var hrs = (s - mins) / 60;
        return hrs + ':' + mins + ':' + secs + '.' + ms;
    }

    var _tracks_next_open = {
        1: -1,
        2: -1,
        3: -1,
        4: -1
    };
    var _i_to_removes = {};

    for (var i = 0; i < beatmap.hitObjects.length; i++) {
        var itr = beatmap.hitObjects[i];
        var type = itr.objectName;
        var track = hitobj_x_to_track_number(itr.position[0]);
        var start_time = itr.startTime;

        if (_tracks_next_open[track] >= start_time) {
            append_to_output(format("--ERROR: Note overlapping another. At time (%s), track(%d). (Note type(%s) number(%d))",
                msToTime(start_time),
                track,
                type,
                i
            ));
            _i_to_removes[i] = true;
            continue;
        } else {
            _tracks_next_open[track] = start_time;
        }

        if (type == "slider") {
            var end_time = start_time + itr.duration;
            if (_tracks_next_open[track] >= end_time) {
                append_to_output(format("--ERROR: Note overlapping another. At time (%s), track(%d). (Note type(%s) number(%d))",
                    msToTime(start_time),
                    track,
                    type,
                    i
                ));
                _i_to_removes[i] = true;
                continue;
            } else {
                _tracks_next_open[track] = end_time;
            }
        }
    }

    beatmap.hitObjects = beatmap.hitObjects.filter(function(x, i) {
        return !(_i_to_removes[i]);
    });

    append_to_output("local rtv = {}");
    append_to_output(format("rtv.%s = \"%s\"", "AudioAssetId", "rbxassetid://" + audio_id));
    append_to_output(format("rtv.%s = \"%s\"", "AudioFilename", beatmap.Title));
    append_to_output(format("rtv.%s = \"%s\"", "AudioArtist", artist));
    append_to_output(format("rtv.%s = \"%s\"", "AudioDescription", description));
    append_to_output(format("rtv.%s = \"%s\"", "AudioCoverImageAssetId", "rbxassetid://" + image));

    append_to_output(format("rtv.%s = %d", "AudioDifficulty", difficulty));
    append_to_output(format("rtv.%s = %d", "AudioTimeOffset", -75));
    append_to_output(format("rtv.%s = %d", "AudioVolume", 0.5));
    append_to_output(format("rtv.%s = %d", "AudioNotePrebufferTime", 1500));

    var audioModValue = 0;
    selectedOptions.forEach(function(option) {
        switch (option) {
            case "Easy":
                audioModValue |= 4;
                break;
            case "Normal":
                audioModValue |= 0;
                break;
            case "Hard":
                audioModValue |= 2;
                break;
            case "Insane":
                audioModValue |= 3;
                break;
            case "VIP":
                audioModValue |= 1;
                break;
        }
    });
    
    append_to_output(format("rtv.%s = %d", "AudioMod", audioModValue));
    append_to_output(format("rtv.%s = %d", "AudioHitSFXGroup", 0));
    append_to_output(format("rtv.%s = \"%s\"", "AudioMapper", mapper));

    append_to_output("rtv.HitObjects = {}");
    append_to_output("local function note(time, track) rtv.HitObjects[#rtv.HitObjects+1] = {Time = time; Type = 1; Track = track;} end");
    append_to_output("local function hold(time, track, duration) rtv.HitObjects[#rtv.HitObjects+1] = {Time = time; Type = 2; Track = track; Duration = duration;} end");
    append_to_output("--");

    for (var i = 0; i < beatmap.hitObjects.length; i++) {
        var itr = beatmap.hitObjects[i];
        var type = itr.objectName;
        var track = hitobj_x_to_track_number(itr.position[0]);

        if (type == "slider") {
            append_to_output(format("hold(%d,%d,%d)", itr.startTime, track, itr.duration));
        } else {
            append_to_output(format("note(%d,%d)", itr.startTime, track));
        }
    }
    append_to_output("--");

    append_to_output("rtv.TimingPoints = {");
    for (var i = 0; i < beatmap.timingPoints.length; i++) {
        var itr = beatmap.timingPoints[i];
        append_to_output(format("\t[%d] = { Time = %d; BeatLength = %d; };", i + 1, itr.offset, itr.beatLength));
    }
    append_to_output("};");

    append_to_output("return rtv");

    return rtv_lua;
});
