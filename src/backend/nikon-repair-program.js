"use strict";

// This operation receives a fresh private Vips render of the captured source.
// A relocated NikonScan directory may be rebuilt from that source only when
// every existing target maker fact (including unknown tags) is unchanged.
const NIKON_REPAIR_PROGRAM = String.raw`my $makerValueAvailable;
$makerValueAvailable=sub {
    my($value)=@_;return 0 unless defined($value);
    my $kind=ref($value);return 1 unless $kind;
    return $makerValueAvailable->($$value) if $kind eq 'SCALAR';
    if($kind eq 'ARRAY') { for my $item(@$value) { return 0 unless $makerValueAvailable->($item); }return 1; }
    if($kind eq 'HASH') { for my $item(values %$value) { return 0 unless $makerValueAvailable->($item); }return 1; }
    return 0;
};
my $makerSnapshot=sub {
    my($input)=@_;my $reader=Image::ExifTool->new;
    $reader->Options(Unknown=>2,RequestAll=>1,SaveFormat=>1,SaveBin=>1,Struct=>1,Duplicates=>1);
    $reader->ExtractInfo($input);
    my %tags;my $ambiguous=0;my $unavailable=0;
    for my $tag($reader->GetFoundTags) {
        next unless $reader->GetGroup($tag,0) eq 'MakerNotes';
        my $id=scalar($reader->GetTagID($tag));
        my $key=$reader->GetGroup($tag,1).':'.Image::ExifTool::GetTagName($tag).':'.$id;
        $ambiguous=1 if exists($tags{$key});
        $tags{$key}={id=>$id,format=>scalar($reader->GetGroup($tag,6)),raw=>scalar($reader->GetValue($tag,'Raw'))};
        $unavailable=1 unless $makerValueAvailable->($tags{$key}{raw});
    }
    return {tags=>\%tags,messages=>$messages->($reader),ambiguous=>$ambiguous,unavailable=>$unavailable};
};
my $nikonExpected;
my $nikonProbe=Image::ExifTool->new;
$nikonProbe->ExtractInfo($dst);
my $nikonMessages=$messages->($nikonProbe);
if(!@failures && grep { $_->{kind} eq 'Warning' && $_->{text} eq '[minor] Bad NikonScanIFD directory' } @$nikonMessages) {
    my $source=$makerSnapshot->($src);
    my $target=$makerSnapshot->($dst);
    my $eligible=!@{$source->{messages}} && !$source->{ambiguous} && !$target->{ambiguous} && !$source->{unavailable} && !$target->{unavailable} &&
        keys(%{$source->{tags}});
    my $badScan=0;
    for my $message(@{$target->{messages}}) {
        if($message->{kind} eq 'Warning' && $message->{text} eq '[minor] Bad NikonScanIFD directory') { $badScan++; }
        elsif(!$pendingIPTCDigest->($message)) { $eligible=0; }
    }
    $eligible=0 unless $badScan==1;
    for my $key(keys %{$target->{tags}}) {
        $eligible=0 unless exists($source->{tags}{$key}) && $same->($source->{tags}{$key},$target->{tags}{$key});
    }
    for my $key(keys %{$source->{tags}}) {
        $eligible=0 if !exists($target->{tags}{$key}) && $key!~/^NikonScan:/;
    }
    if(!$eligible) { $add->('Rendered Nikon metadata does not match the captured source'); }
    else {
        my $info=$producerWriter->SetNewValuesFromFile($src,'MakerNotes');
        if(ref($info) ne 'HASH') { $add->('Original Nikon metadata could not be read for repair'); }
        else { for my $key(keys %$info) { $add->($info->{$key}) if $key=~/^(Warning|Error)/; } }
        $nikonExpected=$source->{tags} if !@failures;
    }
}
`;

module.exports = { NIKON_REPAIR_PROGRAM };
