"use strict";

// A fresh Vips candidate may retain, truncate or lose the source IIM packet.
// Preserve its exact bytes instead of rebuilding dates with an invented zone.
const IPTC_PACKET_PROGRAM = String.raw`my $iptcState=sub {
    my($input)=@_;my $reader=Image::ExifTool->new;
    $reader->ImageInfo($input,'IPTC','Photoshop:IPTCDigest','CurrentIPTCDigest');
    my $packet=scalar($reader->GetValue('IPTC','Raw'));
    $packet=$$packet if ref($packet)eq'SCALAR';
    my $digest=scalar($reader->GetValue('Photoshop:IPTCDigest','Raw'));
    my $current=scalar($reader->GetValue('CurrentIPTCDigest','Raw'));
    return {packet=>$packet,digest=>$digest,current=>$current,mime=>scalar($reader->GetValue('MIMEType','ValueConv')),messages=>$messages->($reader)};
};
my $sourceIPTC=$iptcState->($src);
my $targetIPTC=$iptcState->($dst);
my $targetIPTCNotice;
my $restoreIPTC=0;
    for my $message(@{$sourceIPTC->{messages}}) {
        next if (defined($readerViewNotice) || defined($sourceNotice)) &&
            grep { $_->{kind} eq $message->{kind} && $_->{text} eq $message->{text} } @$initialSourceMessages;
        $add->($message->{text});
    }
$add->('Original IPTC tags have no readable binary packet') if !defined($sourceIPTC->{packet}) &&
    grep { $sourceReader->GetGroup($_,0) eq 'IPTC' } $sourceReader->GetFoundTags;
if(!@failures&&defined($sourceIPTC->{packet})) {
    my $original=$sourceIPTC->{packet};my $candidate=$targetIPTC->{packet};
    my $view=$iptcState->($sourceInput);
    $add->($_->{text}) for @{$view->{messages}};
    $add->('Rendered IPTC digest conflicts with the captured source') if
        defined($targetIPTC->{digest}) && (!defined($sourceIPTC->{current}) || $targetIPTC->{digest} ne $sourceIPTC->{current});
    $add->('Capture reader view changed the original IPTC packet') unless defined($view->{packet})&&!ref($view->{packet})&&$view->{packet}eq$original;
    $add->('Original IPTC packet is not self-contained binary data') if ref($original)||!length($original);
    if(!@failures&&(!defined($candidate)||$candidate ne $original)) {
        $add->('Rendered IPTC packet conflicts with the captured source') if defined($candidate)&&(ref($candidate)||index($original,$candidate)!=0);
        $restoreIPTC=1 if !@failures;
    }
}
`;

module.exports = { IPTC_PACKET_PROGRAM };
