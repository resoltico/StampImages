#!/usr/bin/env bash
#
# Assertions shared by the macOS integration scenarios.

fail() {
    echo "$*" >&2
    exit 1
}

# assert_contains <haystack> <needle> <label>
assert_contains() {
    case "$1" in
        *"$2"*) : ;;
        *) fail "$3: expected to find '$2' in: $1" ;;
    esac
}

# Reads one pixel of an image as "R G B".
#
# vips getpoint prints the channels space separated on a single line, so the
# separators must be normalised rather than deleted.
getpoint() {
    vips getpoint "$1" "$2" "$3" | tr -d '[],' | tr -s ' ' ' '
}

# stamped_pixels <image> <left> <top> <width> <height> <background>
#
# Counts the pixels in a region that are not the background colour.
#
# The fixtures are one flat colour, so "not the background" is exactly
# "stamped". Measured with vips rather than eyeballed: a screenshot proves
# nothing in a shell, and a stamp that landed in the wrong corner passes every
# assertion about the file itself.
stamped_pixels() {
    local image=$1 left=$2 top=$3 width=$4 height=$5 background=$6
    local work
    work=$(mktemp -d -t StampImages-assert)

    vips crop "$image" "$work/region.v" "$left" "$top" "$width" "$height"
    # Every band differs, rather than any: a JPEG rounds a flat colour exactly
    # and rounds an edge unevenly, and one band off by one is not a glyph.
    vips relational_const "$work/region.v" "$work/differs.v" noteq "$background"
    vips bandmean "$work/differs.v" "$work/mean.v"
    vips relational_const "$work/mean.v" "$work/marked.v" more 200
    vips avg "$work/marked.v" |
        awk -v pixels="$((width * height))" \
            '{ printf "%d\n", ($1 / 255) * pixels + 0.5 }'

    rm -rf "$work"
}

# assert_not_contains <haystack> <needle> <label>
assert_not_contains() {
    case "$1" in
        *"$2"*) fail "$3: did not expect to find '$2' in: $1" ;;
        *) : ;;
    esac
}

# assert_nothing_left_behind <folder>
#
# The place a publication makes for itself is hidden and named for the attempt
# that made it, so a folder still holding one afterwards is a publication that
# did not finish tidying up after itself.
assert_nothing_left_behind() {
    test -z "$(find "$1" -maxdepth 1 -name '.StampImages-*')" ||
        fail "a staging place was left in $1: $(ls -a "$1")"
}
