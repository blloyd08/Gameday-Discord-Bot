import json
import urllib.parse
import boto3

print('Loading function')

s3 = boto3.client('s3')
ses = boto3.client('ses')
BUCKET_NAME = "gameday-audio"
AUDIO_JSON_FILENAME = "userAudio.json"

class FilePath:
  def __init__(self, fileName, ext, userId, folders):
    self.fileName = fileName
    self.extension = ext
    self.userId = userId
    self.folders = folders
    self.isUserFile = self.userId is not None
    self.folderlessPath = f'{self.userId}-{self.fileName}.{self.extension}' if self.isUserFile else f'{self.fileName}.{self.extension}'



def lambda_handler(event, context):
    #print("Received event: " + json.dumps(event, indent=2))

    # Get the object from the event and show its content type
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
    
    # Get path of new file
    folderPath = parse_file_path(key)
    returnMessage = folderPath.folderlessPath + "--"
    testData = get_audio_json()
    
    # add file to config file
    audioType = "users" if folderPath.isUserFile else "clips"
    audioKey = folderPath.userId if folderPath.isUserFile else folderPath.fileName
    testData[audioType][audioKey.lower()] = folderPath.folderlessPath
    
    # # write the update json file
    json_data = (bytes(json.dumps(testData).encode('UTF-8')))
    write_json(json_data)

    # send email notification that a new file was added
    send_notification_email(folderPath.fileName)

    return testData["users"]

def send_notification_email(fileName):
    receipient = ""
    charset = "UTF-8"
    body_text = ("Gamdeday Audio bot \r\n Added new file " + fileName)
    body_html = "<html><head></head><body><h1>Gameday Audio bot: New File</h1><p> Added new file " + fileName + "</p></body></html>"

    response = ses.send_email(
        Destination={
            'ToAddresses': [
                receipient
            ]
        },
        Message={
            'Body':{
                'Html': {
                    'Charset': charset,
                    'Data': body_html
                },
                'Text': {
                    'Charset': charset,
                    'Data': body_text
                }
            },
            'Subject': {
                'Charset': charset,
                'Data': "New Gameday Audio clip"
            }
        },
        Source=receipient
    )
    print("Email sent!")
    print("Message id:" + response['MessageId'])
    
def get_audio_json():
    json_data = {}
    try:
        response = s3.get_object(Bucket=BUCKET_NAME, Key=AUDIO_JSON_FILENAME)
        json_data = json.loads(response["Body"].read().decode('UTF-8'))
    except Exception as e:
        print(e)
        print('Error getting the existing audio json')
        raise e
    return json_data
    
def write_json(json_data):
    try:
        response = s3.put_object(Bucket=BUCKET_NAME,Key=AUDIO_JSON_FILENAME,Body=json_data)
    except Exception as e:
        print(e)
        print('Error putting object {} from bucket'.format(json_data))
        raise e

def parse_file_path(path):
  folders = path.split('/')
  fileFullName = folders[-1]
  folders = None if len(folders) == 1 else folders[:-1] 
  extensionIndex = fileFullName.rfind(".")
  fileName = fileFullName[:extensionIndex]
  extension = fileFullName[extensionIndex + 1:]
  indexOfHyphen = fileName.find("-")
  userId = None

  if indexOfHyphen >= 0 and fileName[0].isdigit():
    # Parse user id from filename. User audio file is <user-id>-<audiofilename>.ext
    userId = fileName[:indexOfHyphen]
    fileName = fileName[indexOfHyphen + 1:]
  
  return FilePath(fileName, extension, userId, folders)