import sys
import os
import thread

def ws_rtsp(file_path):
    #redirect stdout and stderr
    cmd = "/usr/bin/websock_rtsp_proxy --config " + file_path
    print "run command:\t"+cmd
    #run cmd in shell
    output = os.popen(cmd)

#main start
def main(argv):
    print len(argv)
    # start 2 threads
    try:
        thread.start_new_thread( ws_rtsp, ("./ws_rtsp0.ini",) )
        thread.start_new_thread( ws_rtsp, ("./ws_rtsp1.ini",) )
        '''
        thread.start_new_thread( netcat_from_file, (9011,"long2.h264") )
        thread.start_new_thread( netcat_from_file, (9012,"long2.h264") )
        thread.start_new_thread( netcat_from_file, (9013,"long.h264") )
        '''
        
    except:
        print "Error: unable to start thread"

    while 1:
        pass



if __name__ == '__main__':
    main(sys.argv)
